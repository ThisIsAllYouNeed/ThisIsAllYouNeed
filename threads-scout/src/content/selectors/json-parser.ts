import type { ThreadPost } from '../../shared/types'
import { SELECTORS } from './config'

/**
 * 從 data-sjs script 解析貼文結構化資料
 * Threads 將許多資料以 JSON 形式內嵌在頁面中
 */
export function parsePostFromJSON(element: HTMLElement): ThreadPost | null {
  try {
    // 尋找最近的 data-sjs script
    const scripts = document.querySelectorAll(SELECTORS.dataScript)
    if (scripts.length === 0) return null

    // 遍歷所有 data-sjs script，尋找包含此貼文資料的 JSON
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? '')
        const post = extractPostData(data, element)
        if (post) return post
      } catch {
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

/** 從 JSON 資料結構中遞迴搜尋貼文資料 */
function extractPostData(data: unknown, _element: HTMLElement): ThreadPost | null {
  if (!data || typeof data !== 'object') return null

  // Threads 的 JSON 結構可能包含 text_post_app_info、post 等欄位
  // 這裡做遞迴搜尋，找到 post-like 結構

  const obj = data as Record<string, unknown>

  // 直接匹配 Threads 貼文結構
  if (obj.text_post_app_info && obj.user) {
    return buildPost(obj)
  }

  // 遞迴搜尋
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = extractPostData(item, _element)
        if (result) return result
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = extractPostData(value, _element)
      if (result) return result
    }
  }

  return null
}

/** 從符合的物件建立 ThreadPost */
function buildPost(obj: Record<string, unknown>): ThreadPost | null {
  try {
    const user = obj.user as Record<string, unknown> | undefined
    const textInfo = obj.text_post_app_info as Record<string, unknown> | undefined

    if (!user || !textInfo) return null

    const username = (user.username as string) ?? ''
    const fullName = (user.full_name as string) ?? username

    // 嘗試取得貼文內文
    const shareInfo = textInfo.share_info as Record<string, unknown> | undefined
    const quotedPost = shareInfo?.quoted_post as Record<string, unknown> | undefined

    // 取得直接文字或引用文字
    const caption = obj.caption as Record<string, unknown> | undefined
    const textContent = (caption?.text as string) ?? ''

    const code = (obj.code as string) ?? ''
    const pk = (obj.pk as string) ?? (obj.id as string) ?? ''
    const likeCount = (obj.like_count as number) ?? 0
    const takenAt = obj.taken_at as number | undefined

    return {
      id: pk || code,
      url: code ? `https://www.threads.net/@${username}/post/${code}` : '',
      author: fullName,
      authorHandle: username,
      textContent,
      timestamp: takenAt ? new Date(takenAt * 1000).toISOString() : '',
      likes: likeCount,
      replies: [],
    }
  } catch {
    return null
  }
}
