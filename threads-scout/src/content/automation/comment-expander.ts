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
  try {
    // 找到貼文的 permalink 連結（時間戳連結）
    const permalink = postElement.querySelector(SELECTORS.permalink) as HTMLElement | null
    if (!permalink) return []

    // 記錄目前滾動位置
    const scrollY = window.scrollY

    // 點擊進入詳情頁
    permalink.click()

    // 等待 URL 變更（SPA 導航）
    const navigated = await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout)
    if (!navigated) return []

    // 等待留言載入
    await sleep(1500)

    // 抓取留言（跳過第一個容器 = 主貼文）
    const replies = scrapeRepliesFromDetailPage()

    // 返回 feed
    history.back()
    const returned = await waitForNavigation(SCROLL_CONFIG.commentExpandTimeout)
    if (!returned) return []
    await sleep(500)

    // 恢復滾動位置
    window.scrollTo(0, scrollY)

    return replies
  } catch {
    // 確保回到 feed
    if (window.location.pathname.includes('/post/')) {
      history.back()
      await sleep(1000)
    }
    return []
  }
}

/** 從詳情頁抓取留言 */
function scrapeRepliesFromDetailPage(): ThreadPost['replies'] {
  const containers = document.querySelectorAll(SELECTORS.postContainer)
  const replies: ThreadPost['replies'] = []

  // 跳過第一個（主貼文），最多抓 10 則留言
  for (let i = 1; i < Math.min(11, containers.length); i++) {
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
