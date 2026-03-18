import type { ThreadPost } from '../../shared/types'
import { SELECTORS } from './config'

/**
 * DOM fallback：從 DOM 結構提取貼文資料
 * 當 data-sjs JSON 解析失敗時使用
 */
export function parsePostFromDOM(element: HTMLElement): ThreadPost | null {
  try {
    // 提取作者 handle
    const handleLink = element.querySelector(SELECTORS.authorHandle) as HTMLAnchorElement | null
    const authorHandle = handleLink?.href
      ? new URL(handleLink.href).pathname.replace(/^\/@/, '').replace(/\/$/, '')
      : ''

    // 提取作者名稱
    const authorEl = element.querySelector(SELECTORS.authorName)
    const author = authorEl?.textContent?.trim() ?? authorHandle

    // 提取貼文內文（取最長的 dir="auto" 文字區塊）
    const textElements = element.querySelectorAll('[dir="auto"]')
    let textContent = ''
    for (const el of textElements) {
      const text = el.textContent?.trim() ?? ''
      // 跳過作者名稱等短文字
      if (text.length > textContent.length && text !== author && text !== authorHandle) {
        textContent = text
      }
    }

    // 提取時間戳
    const timeEl = element.querySelector(SELECTORS.timestamp)
    const timestamp = timeEl?.getAttribute('datetime') ?? ''

    // 提取按讚數
    const likes = extractLikeCount(element)

    // 提取 URL
    const url = extractPostUrl(element, authorHandle)

    // 生成 ID
    const id = url ? extractPostId(url) : `dom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (!textContent) return null

    return {
      id,
      url,
      author,
      authorHandle,
      textContent,
      timestamp,
      likes,
      replies: [],
    }
  } catch {
    return null
  }
}

/** 從 DOM 提取按讚數 */
function extractLikeCount(element: HTMLElement): number {
  const buttons = element.querySelectorAll('[role="button"]')
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label') ?? ''
    const match = label.match(/(\d+)\s*(like|讚)/)
    if (match) return parseInt(match[1], 10)
  }
  return 0
}

/** 從 DOM 提取貼文 URL */
function extractPostUrl(element: HTMLElement, authorHandle: string): string {
  // 尋找包含 /post/ 的連結
  const links = element.querySelectorAll('a[href]')
  for (const link of links) {
    const href = (link as HTMLAnchorElement).href
    if (SELECTORS.permalinkPattern.test(href)) {
      return href
    }
  }

  // 如果找不到，嘗試從 time 元素的父連結取得
  const timeEl = element.querySelector('time')
  const timeLink = timeEl?.closest('a')
  if (timeLink?.href && SELECTORS.permalinkPattern.test(timeLink.href)) {
    return timeLink.href
  }

  return authorHandle ? `https://www.threads.net/@${authorHandle}` : ''
}

/** 從 URL 提取貼文 ID */
function extractPostId(url: string): string {
  const match = url.match(/\/post\/([\w]+)/)
  return match ? match[1] : url
}
