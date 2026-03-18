import type { ThreadPost } from '../../shared/types'
import { SELECTORS } from './config'

const MAX_RECURSION_DEPTH = 10

/**
 * 從 data-sjs script 解析貼文結構化資料
 * Threads 將許多資料以 JSON 形式內嵌在頁面中
 */
export function parsePostFromJSON(element: HTMLElement): ThreadPost | null {
  try {
    const scripts = document.querySelectorAll(SELECTORS.dataScript)
    if (scripts.length === 0) return null

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? '')
        const post = extractPostData(data, 0)
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

/** 從 JSON 資料結構中遞迴搜尋貼文資料（有深度限制） */
function extractPostData(data: unknown, depth: number): ThreadPost | null {
  if (!data || typeof data !== 'object' || depth > MAX_RECURSION_DEPTH) return null

  const obj = data as Record<string, unknown>

  if (obj.text_post_app_info && obj.user) {
    return buildPost(obj)
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = extractPostData(item, depth + 1)
        if (result) return result
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = extractPostData(value, depth + 1)
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
