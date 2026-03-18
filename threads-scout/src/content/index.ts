import type { ExtensionMessage, StartScanMessage } from '../shared/messages'
import type { ThreadPost } from '../shared/types'
import { parsePostFromJSON } from './selectors/json-parser'
import { parsePostFromDOM } from './selectors/dom-fallback'
import { SmartScroller } from './automation/scroller'
import { fetchReplies } from './automation/comment-expander'
import { SELECTORS } from './selectors/config'

// 清除前一個實例（scripting.executeScript 重複注入時）
const win = window as unknown as { __threadsScoutDestroy?: () => void }
win.__threadsScoutDestroy?.()

/** 實例存活旗標，清除時設為 false 以停止自動重連 */
let alive = true
let retryCount = 0

/** 已處理的貼文 ID */
const processedPosts = new Set<string>()

/** 掃描控制 */
let isScanning = false
let isPaused = false
let targetCount = 50
let scannedCount = 0

/** Port 連線到 Service Worker */
let port: chrome.runtime.Port | null = null

/** 智慧滾動器 */
let scroller: SmartScroller | null = null

/** Observer 引用，供停止時清除 */
let intersectionObserver: IntersectionObserver | null = null
let mutationObserver: MutationObserver | null = null

/** 防止 fetchReplies 重入 */
let isFetchingReplies = false

/** 在 fetchReplies 期間被跳過的元素，等完成後重新處理 */
let pendingElements: HTMLElement[] = []

function connectPort() {
  if (!alive || retryCount >= 5) return
  try {
    port = chrome.runtime.connect({ name: 'content' })
    retryCount = 0
    port.onMessage.addListener(handleMessage)
    port.onDisconnect.addListener(() => {
      port = null
      scheduleReconnect()
    })
  } catch {
    port = null
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (!alive || retryCount >= 5) return
  const delay = Math.min(1000 * 2 ** retryCount, 30000)
  retryCount++
  setTimeout(connectPort, delay)
}

/** 安全發送訊息，斷線時不拋錯 */
function safeSend(msg: Record<string, unknown>) {
  try {
    port?.postMessage(msg)
  } catch {
    port = null
  }
}

function handleMessage(msg: ExtensionMessage) {
  switch (msg.type) {
    case 'START_SCAN':
      startScan(msg as StartScanMessage)
      break
    case 'PAUSE_SCAN':
      isPaused = true
      scroller?.pause()
      break
    case 'RESUME_SCAN':
      isPaused = false
      scroller?.resume()
      break
    case 'STOP_SCAN':
      stopScan()
      break
  }
}

async function startScan(msg: StartScanMessage) {
  // 清除前次掃描的 observer
  stopScan()

  targetCount = msg.targetCount
  scannedCount = 0
  processedPosts.clear()
  isScanning = true
  isPaused = false
  isFetchingReplies = false
  pendingElements = []

  log('[啟動] 開始掃描，目標 ' + targetCount + ' 篇')

  scroller = new SmartScroller()
  scroller.onWaitTime = (sec) => {
    safeSend({ type: 'WAIT_TIME', seconds: sec })
    log(`[滾動] 等待 ${sec}s...`)
  }
  scroller.onLog = (text) => log(text)

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !isScanning || isPaused) continue

        if (isFetchingReplies) {
          // 導航期間暫存，稍後處理（僅保留仍在 DOM 中的 feed 元素）
          if (document.contains(entry.target)) {
            pendingElements.push(entry.target as HTMLElement)
          }
          continue
        }

        processPost(entry.target as HTMLElement)
      }
    },
    { threshold: 0.5 },
  )

  observePosts(intersectionObserver)
  scroller.start(targetCount)
}

function log(text: string) {
  safeSend({ type: 'LOG', text })
}

async function processPost(element: HTMLElement) {
  if (!isScanning || isFetchingReplies) return

  const post = extractPost(element)
  if (!post || processedPosts.has(post.id)) return

  processedPosts.add(post.id)
  scannedCount++

  const preview = post.textContent.slice(0, 40).replace(/\n/g, ' ')
  log(`[掃描] #${scannedCount} @${post.authorHandle}: ${preview}...`)

  // 點進詳情頁抓取留言再返回
  isFetchingReplies = true
  scroller?.pause()
  log(`[留言] 進入詳情頁 → ${post.url}`)
  try {
    post.replies = await fetchReplies(element)
    log(`[留言] 返回 feed，抓到 ${post.replies.length} 則留言`)
  } finally {
    isFetchingReplies = false
    scroller?.resume()
  }

  safeSend({ type: 'POST_SCRAPED', post })

  if (scannedCount >= targetCount) {
    log(`[完成] 已達目標 ${targetCount} 篇`)
    stopScan()
    safeSend({ type: 'SCAN_COMPLETE', totalScraped: scannedCount })
    return
  }

  // 處理在 fetchReplies 期間被跳過的元素（過濾掉已脫離 DOM 的詳情頁殘留）
  const pending = pendingElements.splice(0)
  if (pending.length > 0) {
    const valid = pending.filter(el => document.contains(el))
    log(`[佇列] ${pending.length} 個待處理元素，${valid.length} 個仍在 DOM`)
    for (const el of valid) {
      if (!isScanning) break
      await processPost(el)
    }
  }
}

function stopScan() {
  isScanning = false
  isPaused = false
  isFetchingReplies = false
  pendingElements = []
  scroller?.stop()
  scroller = null
  intersectionObserver?.disconnect()
  intersectionObserver = null
  mutationObserver?.disconnect()
  mutationObserver = null
}

/** 從 element 提取貼文資料（先 JSON 後 DOM） */
function extractPost(element: HTMLElement): ThreadPost | null {
  return parsePostFromJSON(element) ?? parsePostFromDOM(element)
}

/** 監聽 DOM 中的貼文容器 */
function observePosts(observer: IntersectionObserver) {
  document.querySelectorAll(SELECTORS.postContainer).forEach(el => {
    observer.observe(el)
  })

  mutationObserver = new MutationObserver((mutations) => {
    if (!isScanning) {
      mutationObserver?.disconnect()
      return
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          const posts = node.matches(SELECTORS.postContainer)
            ? [node]
            : Array.from(node.querySelectorAll(SELECTORS.postContainer))
          posts.forEach(el => observer.observe(el))
        }
      }
    }
  })

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

// 註冊清除函式供下次注入使用
win.__threadsScoutDestroy = () => {
  alive = false
  stopScan()
  port?.disconnect()
  port = null
}

connectPort()
