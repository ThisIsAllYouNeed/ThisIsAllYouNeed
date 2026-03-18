import { SCROLL_CONFIG } from '../../shared/constants'
import type { ThreadPost } from '../../shared/types'
import { SELECTORS } from '../selectors/config'

/** 需要過濾的 UI 文字 */
const UI_NOISE = ['translate', 'like', 'reply', 'repost', 'share', 'more', 'follow']

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

    permalink.click()

    const navigated = await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout)
    if (!navigated) return []

    // 等待詳情頁 DOM 穩定（主貼文 + 留言都需要時間渲染）
    await sleep(1000)

    // 計算主貼文 thread 佔幾個容器（開頭連續同作者的容器）
    const mainThreadCount = countMainThread()

    // 等待留言載入（可見容器數超過主 thread）
    await waitForReplies(SCROLL_CONFIG.waitForRepliesTimeout, mainThreadCount)

    const replies = scrapeRepliesFromDetailPage(mainThreadCount)

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
  return Math.max(1, count)
}

/** 從詳情頁抓取留言，skipCount 為主貼文佔的容器數 */
function scrapeRepliesFromDetailPage(skipCount: number = 1): ThreadPost['replies'] {
  const containers = getVisibleContainers()
  const replies: ThreadPost['replies'] = []

  // 跳過主貼文容器，只抓後面的留言（最多 10 則）
  for (let i = skipCount; i < Math.min(skipCount + 10, containers.length); i++) {
    const el = containers[i]
    const author = el.querySelector(SELECTORS.authorHandle)?.textContent?.trim() ?? ''

    // 取得所有 dir=auto 文字，過濾 UI 噪音
    const textEls = Array.from(el.querySelectorAll(SELECTORS.textContent))
    const texts = textEls
      .map(t => t.textContent?.trim() ?? '')
      .filter(t => {
        if (t.length <= 3) return false
        if (t === author) return false
        const lower = t.toLowerCase()
        if (UI_NOISE.some(noise => lower === noise || /^\d+$/.test(lower))) return false
        return true
      })

    // 取最長的文字作為留言內容，並移除尾部的 UI 文字
    const rawText = texts.reduce((a, b) => b.length > a.length ? b : a, '')
    if (!rawText) continue

    const cleanText = rawText
      .replace(/\s*(Translate|翻譯)\s*$/i, '')
      .replace(/\s*\d+\/\d+\s*$/, '')
      .trim()

    if (cleanText) {
      replies.push({ index: i, author, textContent: cleanText })
    }
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

/** 等待 URL 變更 */
function waitForNavigation(timeout: number): Promise<boolean> {
  const startUrl = window.location.href
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
