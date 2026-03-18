import type { ExtensionMessage, StartScanMessage } from '../shared/messages'
import type { ThreadPost } from '../shared/types'
import { parsePostFromJSON } from './selectors/json-parser'
import { parsePostFromDOM } from './selectors/dom-fallback'
import { SmartScroller } from './automation/scroller'
import { fetchReplies } from './automation/comment-expander'
import { SELECTORS } from './selectors/config'
import { SCROLL_CONFIG } from '../shared/constants'

/** 判斷是否在 feed 頁面（非貼文詳情頁） */
function isOnFeedPage(): boolean {
  return !window.location.pathname.includes('/post/')
}

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

/** 掃描開始時的 feed URL，用於迷路時導航回去 */
let feedUrl = ''

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

  feedUrl = window.location.href
  log('[啟動] 開始掃描，目標 ' + targetCount + ' 篇')

  scroller = new SmartScroller()
  scroller.onWaitTime = (sec) => {
    safeSend({ type: 'WAIT_TIME', seconds: sec })
    log(`[滾動] 等待 ${sec}s...`)
  }
  scroller.onLog = (text) => log(text)
  scroller.onRecoverPage = () => ensureOnFeed()

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !isScanning || isPaused) continue

        // 在詳情頁時忽略所有 intersection 事件，避免把留言當成 feed 貼文
        if (!isOnFeedPage()) continue

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

/** 確認在 feed 頁面，否則導航回去。回傳 true 表示有執行導航。 */
async function ensureOnFeed(): Promise<boolean> {
  if (isOnFeedPage()) return false

  log('[導航] 未回到 feed，嘗試 history.back()...')
  history.back()

  // 輪詢等待 URL 變回 feed（比固定 sleep 更快）
  if (await waitUntilOnFeed(SCROLL_CONFIG.navigationWaitTimeout)) {
    log('[導航] 已回到 feed')
    return true
  }

  if (feedUrl) {
    log(`[導航] history.back() 失敗，直接跳轉 ${feedUrl}`)
    window.location.href = feedUrl
    await sleep(SCROLL_CONFIG.hardNavigationWait)
  }
  return true
}

/** 輪詢等待回到 feed 頁面 */
async function waitUntilOnFeed(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (isOnFeedPage()) return true
    await sleep(200)
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function processPost(element: HTMLElement) {
  if (!isScanning || isFetchingReplies) return

  const post = extractPost(element)
  if (!post || processedPosts.has(post.id)) return

  processedPosts.add(post.id)
  scannedCount++

  const preview = post.textContent.slice(0, 40).replace(/\n/g, ' ')
  log(`[掃描] #${scannedCount} @${post.authorHandle}: ${preview}...`)

  // 只在 feed 頁面才進入詳情頁抓取留言，避免嵌套導航
  const onFeed = isOnFeedPage()
  if (onFeed) {
    isFetchingReplies = true
    scroller?.pause()
    log(`[留言] 進入詳情頁 → ${post.url}`)
    let timerId: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<ThreadPost['replies']>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('fetchReplies 超時')), SCROLL_CONFIG.fetchRepliesTimeout)
      })
      post.replies = await Promise.race([fetchReplies(element), timeout])
      log(`[留言] 返回 feed，抓到 ${post.replies.length} 則留言`)
    } catch (err) {
      log(`[留言] 抓取失敗: ${err instanceof Error ? err.message : '未知錯誤'}`)
      post.replies = []
    } finally {
      clearTimeout(timerId)
      // 先確認回到 feed 再解除鎖定，避免 observer 在導航中處理元素
      try {
        await ensureOnFeed()
      } finally {
        isFetchingReplies = false
        scroller?.resume()
      }
    }
  } else {
    log(`[留言] 跳過留言抓取（不在 feed 頁面）`)
    post.replies = []
  }

  safeSend({ type: 'POST_SCRAPED', post })

  if (scannedCount >= targetCount) {
    log(`[完成] 已達目標 ${targetCount} 篇`)
    stopScan()
    safeSend({ type: 'SCAN_COMPLETE', totalScraped: scannedCount })
    return
  }

  // 處理在 fetchReplies 期間被跳過的元素（過濾掉已脫離 DOM 的詳情頁殘留）
  if (!isOnFeedPage()) {
    // 不在 feed 頁面時清空佇列，這些元素來自詳情頁
    pendingElements = []
  } else {
    const pending = pendingElements.splice(0)
    if (pending.length > 0) {
      const valid = pending.filter(el => document.contains(el))
      log(`[佇列] ${pending.length} 個待處理元素，${valid.length} 個仍在 DOM`)
      for (const el of valid) {
        if (!isScanning || !isOnFeedPage()) break
        await processPost(el)
      }
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
