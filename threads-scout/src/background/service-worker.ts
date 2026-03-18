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

/** 遞增的請求 ID，用於匹配 offscreen 回應 */
let nextRequestId = 0

// === Port 連線管理 ===

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    panelPort = port
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
    case 'WAIT_TIME':
      scanProgress.currentWaitSec = msg.seconds
      throttledBroadcastProgress()
      break
    case 'SCAN_COMPLETE':
      await handleScanComplete()
      break
  }
}

// === 通用的 offscreen 訊息-回應工具 ===

/** 向 offscreen document 發送訊息並等待回應，附加 requestId 避免 race condition */
function sendToOffscreen<T>(
  message: Record<string, unknown>,
  responseType: string,
  extractResult: (msg: ExtensionMessage) => T,
  timeoutMs = 30000,
): Promise<T> {
  const requestId = String(++nextRequestId)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler)
      reject(new Error(`Offscreen 回應逾時 (${responseType})`))
    }, timeoutMs)

    const handler = (msg: ExtensionMessage & { requestId?: string }) => {
      if (msg.type === responseType && msg.requestId === requestId) {
        clearTimeout(timer)
        chrome.runtime.onMessage.removeListener(handler)
        resolve(extractResult(msg))
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    chrome.runtime.sendMessage({ ...message, requestId })
  })
}

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

  // 確保 content script 已連線
  if (!contentPort) {
    const connected = await ensureContentScript()
    if (!connected) {
      sendError('無法連線到 Threads 頁面。請確認你在 Threads 頁面上，並重新整理頁面（F5）後再試。')
      return
    }
  }

  filteredPosts = []
  scanProgress = {
    status: 'scanning',
    scanned: 0,
    filtered: 0,
    analyzed: 0,
    total: currentSettings.targetCount,
  }
  broadcastProgress()

  if (currentSettings.enablePrefilter) {
    await ensureOffscreenDocument()

    let productEmbedding = await getProductEmbedding()
    if (!productEmbedding) {
      productEmbedding = await computeEmbedding(currentSettings.productDescription)
      await saveProductEmbedding(productEmbedding)
    }

    // 確保 offscreen 有產品 embedding（不管是新計算還是從 cache 載入）
    await sendToOffscreen(
      { type: 'SET_PRODUCT_EMBEDDING', embedding: productEmbedding },
      'PRODUCT_EMBEDDING_SET',
      () => {},
    )
  }

  // contentPort 可能在 await 期間斷線，需再次檢查
  if (!contentPort) {
    sendError('Content script 連線中斷，請重新整理頁面後再試。')
    scanProgress.status = 'idle'
    broadcastProgress()
    return
  }

  contentPort.postMessage({
    type: 'START_SCAN',
    targetCount: currentSettings.targetCount,
  })
}

/** 嘗試注入 content script 並等待連線 */
async function ensureContentScript(): Promise<boolean> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]

  if (!tab?.id || !tab.url?.match(/threads\.(net|com)/)) return false

  try {
    const scriptPath = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0]
    if (!scriptPath) return false

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [scriptPath],
    })
  } catch {
    return false
  }

  // 等待 content script 連線（最多 3 秒）
  for (let i = 0; i < 30; i++) {
    if (contentPort) return true
    await new Promise(r => setTimeout(r, 100))
  }

  return false
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

/** 節流用：上次廣播時間 */
let lastBroadcastTime = 0
const BROADCAST_THROTTLE_MS = 300

function throttledBroadcastProgress() {
  const now = Date.now()
  if (now - lastBroadcastTime >= BROADCAST_THROTTLE_MS) {
    lastBroadcastTime = now
    broadcastProgress()
  }
}

async function handlePostScraped(post: ThreadPost) {
  scanProgress.scanned++
  throttledBroadcastProgress()

  if (!currentSettings) return

  // 預過濾開啟時檢查相似度，關閉時所有貼文直接通過
  if (currentSettings.enablePrefilter) {
    const similarity = await computeSimilarity(post.textContent)
    if (similarity < currentSettings.similarityThreshold) return
  }

  scanProgress.filtered++
  throttledBroadcastProgress()
  filteredPosts.push(post)

  if (filteredPosts.length >= LLM_BATCH_SIZE) {
    await analyzeFilteredBatch()
  }
}

async function handleScanComplete() {
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

let offscreenReady = false

async function ensureOffscreenDocument() {
  if (offscreenReady) return

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  })

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: '執行 Transformers.js embedding 模型推理',
    })
  }

  offscreenReady = true
}

/** 計算文字的 embedding */
async function computeEmbedding(text: string): Promise<number[]> {
  await ensureOffscreenDocument()

  return sendToOffscreen(
    { type: 'COMPUTE_EMBEDDING', text },
    'EMBEDDING_READY',
    (msg) => (msg as ExtensionMessage & { embedding: number[] }).embedding,
  )
}

/** 計算貼文與產品的 cosine similarity */
async function computeSimilarity(text: string): Promise<number> {
  await ensureOffscreenDocument()

  return sendToOffscreen(
    { type: 'COMPUTE_SIMILARITY', text },
    'SIMILARITY_RESULT',
    (msg) => {
      if (msg.type === 'SIMILARITY_RESULT') return msg.result.similarity
      return 0
    },
  )
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
