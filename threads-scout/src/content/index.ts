import type { ExtensionMessage, StartScanMessage } from '../shared/messages'
import type { ThreadPost } from '../shared/types'
import { parsePostFromJSON } from './selectors/json-parser'
import { parsePostFromDOM } from './selectors/dom-fallback'
import { SmartScroller } from './automation/scroller'
import { expandComments } from './automation/comment-expander'
import { SELECTORS } from './selectors/config'

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

function connectPort() {
  port = chrome.runtime.connect({ name: 'content' })
  port.onMessage.addListener(handleMessage)
  port.onDisconnect.addListener(() => {
    port = null
    isScanning = false
  })
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

  scroller = new SmartScroller()

  intersectionObserver = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !isScanning || isPaused) continue

        const element = entry.target as HTMLElement
        const post = extractPost(element)

        if (post && !processedPosts.has(post.id)) {
          processedPosts.add(post.id)
          scannedCount++

          await expandComments(element)

          const fullPost = extractPost(element) ?? post
          fullPost.replies = extractReplies(element)

          port?.postMessage({ type: 'POST_SCRAPED', post: fullPost })

          if (scannedCount >= targetCount) {
            stopScan()
            port?.postMessage({ type: 'SCAN_COMPLETE', totalScraped: scannedCount })
            return
          }
        }
      }
    },
    { threshold: 0.5 },
  )

  observePosts(intersectionObserver)
  scroller.start(targetCount)
}

function stopScan() {
  isScanning = false
  isPaused = false
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

/** 提取留言（DOM） */
function extractReplies(element: HTMLElement): ThreadPost['replies'] {
  const replyElements = element.querySelectorAll(SELECTORS.reply)
  const replies: ThreadPost['replies'] = []

  replyElements.forEach((el, index) => {
    const author = el.querySelector(SELECTORS.replyAuthor)?.textContent?.trim() ?? ''
    const text = el.querySelector(SELECTORS.replyText)?.textContent?.trim() ?? ''
    if (text) {
      replies.push({ index: index + 1, author, textContent: text })
    }
  })

  return replies
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

connectPort()
