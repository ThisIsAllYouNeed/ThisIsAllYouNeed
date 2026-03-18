import { SCROLL_CONFIG } from '../../shared/constants'
import { SELECTORS } from '../selectors/config'

/**
 * 展開貼文的第一層留言
 * 尋找「查看回覆」按鈕並點擊，等待留言載入
 */
export async function expandComments(postElement: HTMLElement): Promise<boolean> {
  try {
    const expandButton = findExpandButton(postElement)
    if (!expandButton) return false

    // 點擊展開按鈕
    expandButton.click()

    // 等待留言載入
    const loaded = await waitForReplies(postElement, SCROLL_CONFIG.commentExpandTimeout)
    return loaded
  } catch {
    return false
  }
}

/** 尋找「查看回覆」按鈕 */
function findExpandButton(container: HTMLElement): HTMLElement | null {
  const buttons = container.querySelectorAll(SELECTORS.expandRepliesButton)

  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase() ?? ''
    const matches = SELECTORS.expandRepliesText.some(
      keyword => text.includes(keyword.toLowerCase()),
    )
    if (matches) {
      return btn as HTMLElement
    }
  }

  return null
}

/** 用 MutationObserver 等待留言載入 */
function waitForReplies(container: HTMLElement, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false

    const observer = new MutationObserver((_mutations) => {
      // 檢查是否有新的留言出現
      const replies = container.querySelectorAll(SELECTORS.reply)
      if (replies.length > 0 && !resolved) {
        resolved = true
        observer.disconnect()
        resolve(true)
      }
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        observer.disconnect()
        resolve(false)
      }
    }, timeout)
  })
}
