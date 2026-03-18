import type { ThreadPost } from '../shared/types'
import { parsePostFromJSON } from './selectors/json-parser'
import { parsePostFromDOM } from './selectors/dom-fallback'

/**
 * 嘗試從 JSON 提取貼文資料
 */
export function extractPostFromJSON(element: HTMLElement): ThreadPost | null {
  return parsePostFromJSON(element)
}

/**
 * 嘗試從 DOM 提取貼文資料（fallback）
 */
export function extractPostFromDOM(element: HTMLElement): ThreadPost | null {
  return parsePostFromDOM(element)
}
