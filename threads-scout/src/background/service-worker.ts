import type { ExtensionMessage } from '../shared/messages'
import type { ScanProgress, ThreadPost, Recommendation, UserSettings } from '../shared/types'
import { getSettings, getProductEmbedding, saveProductEmbedding } from '../shared/storage'
import { LLM_BATCH_SIZE } from '../shared/constants'
import { analyzePosts } from './openrouter-client'

/** 掃描狀態 */
let scanProgress: ScanProgress = {
  status: 'idle',
  scanned: 0,
  filtered: 0,
  analyzed: 0,
  total: 50,
}

/** 通過 embedding 過濾的貼文佇列 */
let filteredPosts: ThreadPost[] = []

/** Side Panel 連線 */
let panelPort: chrome.runtime.Port | null = null

/** Content Script 連線 */
let contentPort: chrome.runtime.Port | null = null

/** 目前使用者設定 */
let currentSettings: UserSettings | null = null

// === Port 連線管理 ===

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    panelPort = port
    // 送出目前狀態
    port.postMessage({ type: 'PROGRESS_UPDATE', progress: scanProgress })
    port.onMessage.addListener(handlePanelMessage)
    port.onDisconnect.addListener(() => { panelPort = null })
  }

  if (port.name === 'content') {
    contentPort = port
    port.onMessage.addListener(handleContentMessage)
    port.onDisconnect.addListener(() => { contentPort = null })
  }
})

// === 處理來自 Side Panel 的訊息 ===

async function handlePanelMessage(msg: ExtensionMessage) {
  switch (msg.type) {
    case 'REQUEST_START':
      await startScan()
      break
    case 'REQUEST_PAUSE':
      pauseScan()
      break
    case 'REQUEST_RESUME':
      resumeScan()
      break
    case 'REQUEST_STOP':
      stopScan()
      break
  }
}

// === 處理來自 Content Script 的訊息 ===

async function handleContentMessage(msg: ExtensionMessage) {
  switch (msg.type) {
    case 'POST_SCRAPED':
      await handlePostScraped(msg.post)
      break
    case 'SCAN_COMPLETE':
      await handleScanComplete()
      break
  }
}

// === 處理 Offscreen Document 的訊息 ===

chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  if (msg.type === 'EMBEDDING_READY' || msg.type === 'SIMILARITY_RESULT' || msg.type === 'MODEL_READY' || msg.type === 'MODEL_LOADING') {
    // 這些訊息由各自的 Promise 回呼處理
  }
  sendResponse()
  return false
})

// === 掃描控制 ===

async function startScan() {
  currentSettings = await getSettings()

  if (!currentSettings.apiKey) {
    sendError('請先在 Popup 設定 OpenRouter API Key')
    return
  }

  if (!currentSettings.productDescription) {
    sendError('請先在 Popup 輸入產品描述')
    return
  }

  // 重設狀態
  filteredPosts = []
  scanProgress = {
    status: 'scanning',
    scanned: 0,
    filtered: 0,
    analyzed: 0,
    total: currentSettings.targetCount,
  }
  broadcastProgress()

  // 確保 Offscreen Document 已建立
  await ensureOffscreenDocument()

  // 計算產品 embedding（如果沒有快取）
  let productEmbedding = await getProductEmbedding()
  if (!productEmbedding) {
    productEmbedding = await computeEmbedding(currentSettings.productDescription)
    await saveProductEmbedding(productEmbedding)
  }

  // 通知 Content Script 開始掃描
  contentPort?.postMessage({
    type: 'START_SCAN',
    targetCount: currentSettings.targetCount,
  })
}

function pauseScan() {
  scanProgress.status = 'paused'
  broadcastProgress()
  contentPort?.postMessage({ type: 'PAUSE_SCAN' })
}

function resumeScan() {
  scanProgress.status = 'scanning'
  broadcastProgress()
  contentPort?.postMessage({ type: 'RESUME_SCAN' })
}

function stopScan() {
  scanProgress.status = 'done'
  broadcastProgress()
  contentPort?.postMessage({ type: 'STOP_SCAN' })
}

// === 貼文處理 ===

async function handlePostScraped(post: ThreadPost) {
  scanProgress.scanned++
  broadcastProgress()

  if (!currentSettings) return

  // 計算 embedding 相似度
  const similarity = await computeSimilarity(post.textContent)

  if (similarity >= currentSettings.similarityThreshold) {
    scanProgress.filtered++
    broadcastProgress()
    filteredPosts.push(post)

    // 達到批次大小時送 LLM 分析
    if (filteredPosts.length >= LLM_BATCH_SIZE) {
      await analyzeFilteredBatch()
    }
  }
}

async function handleScanComplete() {
  // 處理剩餘貼文
  if (filteredPosts.length > 0) {
    await analyzeFilteredBatch()
  }

  scanProgress.status = 'done'
  broadcastProgress()
}

async function analyzeFilteredBatch() {
  if (!currentSettings) return

  const batch = filteredPosts.splice(0, LLM_BATCH_SIZE)
  scanProgress.status = 'analyzing'
  broadcastProgress()

  try {
    const recommendations = await analyzePosts(batch, currentSettings)
    scanProgress.analyzed += batch.length
    scanProgress.status = 'scanning'
    broadcastProgress()
    sendRecommendations(recommendations)
  } catch (err) {
    const message = err instanceof Error ? err.message : '分析失敗'
    sendError(message)
    scanProgress.status = 'scanning'
    broadcastProgress()
  }
}

// === Offscreen Document 管理 ===

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  })

  if (existingContexts.length > 0) return

  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: '執行 Transformers.js embedding 模型推理',
  })
}

/** 計算文字的 embedding */
async function computeEmbedding(text: string): Promise<number[]> {
  await ensureOffscreenDocument()

  return new Promise((resolve) => {
    const handler = (msg: ExtensionMessage) => {
      if (msg.type === 'EMBEDDING_READY' && !msg.postId) {
        chrome.runtime.onMessage.removeListener(handler)
        resolve(msg.embedding)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    chrome.runtime.sendMessage({ type: 'COMPUTE_EMBEDDING', text })
  })
}

/** 計算貼文與產品的 cosine similarity */
async function computeSimilarity(text: string): Promise<number> {
  await ensureOffscreenDocument()

  return new Promise((resolve) => {
    const handler = (msg: ExtensionMessage) => {
      if (msg.type === 'SIMILARITY_RESULT') {
        chrome.runtime.onMessage.removeListener(handler)
        resolve(msg.result.similarity)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    chrome.runtime.sendMessage({ type: 'COMPUTE_SIMILARITY', postId: 'temp', text })
  })
}

// === 訊息廣播 ===

function broadcastProgress() {
  panelPort?.postMessage({ type: 'PROGRESS_UPDATE', progress: scanProgress })
}

function sendRecommendations(recommendations: Recommendation[]) {
  panelPort?.postMessage({ type: 'RECOMMENDATION', recommendations })
}

function sendError(error: string) {
  panelPort?.postMessage({ type: 'ERROR', error })
}
