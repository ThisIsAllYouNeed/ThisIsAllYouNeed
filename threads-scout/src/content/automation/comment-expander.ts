import { SCROLL_CONFIG, DETAIL_BROWSE_CONFIG } from '../../shared/constants'
import type { ThreadPost } from '../../shared/types'
import { SELECTORS } from '../selectors/config'
import { parsePostFromDOM } from '../selectors/dom-fallback'

/**
 * 點進貼文詳情頁抓取留言，再返回 feed
 * 回傳留言陣列，失敗時回傳空陣列
 */
export async function fetchReplies(postElement: HTMLElement): Promise<ThreadPost['replies']> {
  // 記錄 feed URL，確保能回來
  const feedUrl = window.location.href
  const scrollY = window.scrollY

  try {
    const permalink = postElement.querySelector(SELECTORS.permalink) as HTMLElement | null
    if (!permalink) return []

    // ISOLATED world 的 .click() 無法觸發 Threads 的 React SPA 導航，
    // 透過 service worker 在 MAIN world 執行點擊
    permalink.setAttribute('data-tsc-click', '1')
    try {
      await chrome.runtime.sendMessage({ type: 'CLICK_PERMALINK' })
    } catch {
      return []
    } finally {
      permalink.removeAttribute('data-tsc-click')
    }

    // 傳入 feedUrl 作為基準，因為 SPA 導航可能在 await sendMessage 期間已完成
    const navigated = await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout, feedUrl)
    if (!navigated) return []

    // 等待詳情頁 DOM 穩定（主貼文 + 留言都需要時間渲染）
    await sleep(SCROLL_CONFIG.detailPageSettleWait)

    // 計算主貼文 thread 佔幾個容器（開頭連續同作者的容器）
    const mainThreadCount = countMainThread()

    // 等待留言載入（可見容器數超過主 thread）
    await waitForReplies(SCROLL_CONFIG.waitForRepliesTimeout, mainThreadCount)

    const replies = scrapeRepliesFromDetailPage(mainThreadCount)

    // 模擬閱讀留言：逐段捲動瀏覽
    await browseDetailPage()

    // 返回 feed（最多重試一次）
    await navigateBack(feedUrl)
    await sleep(500)

    // Threads SPA 返回後可能需要時間重新渲染 feed 內容
    // 先滾動到頂部附近讓 Threads 載入 feed，再慢慢回到原位
    window.scrollTo(0, 0)
    await sleep(300)
    window.scrollTo(0, Math.min(scrollY, document.documentElement.scrollHeight - window.innerHeight))
    await sleep(500)

    return replies
  } catch {
    // 任何錯誤都確保回到 feed
    await navigateBack(feedUrl)
    return []
  }
}

/** 返回 feed 頁面，history.back() 失敗時直接跳轉 */
async function navigateBack(feedUrl: string): Promise<void> {
  if (!window.location.pathname.includes('/post/')) return

  history.back()
  const returned = await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout)
  if (returned) return

  // history.back() 失敗，直接跳轉回 feed
  window.location.href = feedUrl
  await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout * 2)
  await sleep(1000)
}

/** 取得詳情頁中可見的貼文容器（過濾掉 SPA 背景中隱藏的 feed 元素） */
function getVisibleContainers(): HTMLElement[] {
  const all = document.querySelectorAll(SELECTORS.postContainer)
  return Array.from(all).filter((el): el is HTMLElement =>
    el instanceof HTMLElement && el.offsetHeight > 0
  )
}

/**
 * 計算主貼文 thread 佔幾個容器
 * Threads 的多段貼文（thread）在詳情頁會佔多個 [data-pressable-container]，
 * 全部由同一作者發出。留言區從第一個不同作者的容器開始。
 * 使用 href 比較而非 textContent，因為頭像連結的 textContent 可能為空。
 */
function countMainThread(): number {
  const containers = getVisibleContainers()
  if (containers.length === 0) return 1

  const mainAuthorHref = containers[0].querySelector(SELECTORS.authorHandle)?.getAttribute('href') ?? ''
  if (!mainAuthorHref) return 1

  let count = 0
  for (const el of containers) {
    const href = el.querySelector(SELECTORS.authorHandle)?.getAttribute('href') ?? ''
    if (href !== mainAuthorHref) break
    count++
  }
  return count
}

/** 從詳情頁抓取留言，skipCount 為主貼文佔的容器數 */
function scrapeRepliesFromDetailPage(skipCount: number = 1): ThreadPost[] {
  const containers = getVisibleContainers()
  const replies: ThreadPost[] = []

  // 跳過主貼文容器，只抓後面的留言（最多 10 則）
  for (let i = skipCount; i < Math.min(skipCount + 10, containers.length); i++) {
    const post = parsePostFromDOM(containers[i])
    if (!post) continue
    replies.push(post)
  }

  return replies
}

/** 等待留言容器出現（可見容器數超過主貼文的初始數量） */
async function waitForReplies(timeout: number, initialCount: number): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const count = getVisibleContainers().length
    if (count > initialCount) return
    await sleep(300)
  }
}

/** 等待 URL 變更（可傳入 referenceUrl 避免 race condition） */
async function waitForNavigation(timeout: number, referenceUrl?: string): Promise<boolean> {
  const startUrl = referenceUrl ?? window.location.href
  // URL 可能在呼叫前已變更（例如 MAIN world click 的 SPA 導航快於 message round-trip）
  if (window.location.href !== startUrl) return true
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.location.href !== startUrl) {
        clearInterval(interval)
        resolve(true)
      }
    }, 100)

    setTimeout(() => {
      clearInterval(interval)
      resolve(window.location.href !== startUrl)
    }, timeout)
  })
}

/** 在詳情頁模擬閱讀：逐段往下捲動，偶爾回捲 */
async function browseDetailPage(): Promise<void> {
  const tickCount = randomInt(
    DETAIL_BROWSE_CONFIG.tickCountMin,
    DETAIL_BROWSE_CONFIG.tickCountMax,
  )

  for (let i = 0; i < tickCount; i++) {
    const pause = randomInt(
      DETAIL_BROWSE_CONFIG.tickPauseMin,
      DETAIL_BROWSE_CONFIG.tickPauseMax,
    )
    await sleep(pause)

    const tickSize = window.innerHeight * (
      DETAIL_BROWSE_CONFIG.tickSizeMin +
      Math.random() * (DETAIL_BROWSE_CONFIG.tickSizeMax - DETAIL_BROWSE_CONFIG.tickSizeMin)
    )
    const goDown = Math.random() < DETAIL_BROWSE_CONFIG.downwardProb
    const distance = goDown ? tickSize : -tickSize * DETAIL_BROWSE_CONFIG.backscrollRatio
    window.scrollBy(0, distance)
  }

  await sleep(randomInt(DETAIL_BROWSE_CONFIG.finalPauseMin, DETAIL_BROWSE_CONFIG.finalPauseMax))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
