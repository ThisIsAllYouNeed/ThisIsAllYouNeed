import { SCROLL_CONFIG } from '../../shared/constants'
import { SELECTORS } from '../selectors/config'

/** 卡住偵測：連續幾次滾動無效後觸發恢復 */
const STUCK_THRESHOLD = 3
/** 卡住恢復：等待新內容載入的最長時間（毫秒） */
const STUCK_WAIT_MS = 5000

/**
 * 智慧滾動引擎
 * 依貼文內容長度決定停留時間和滾動距離，模擬真實閱讀行為
 */
export class SmartScroller {
  private running = false
  private paused = false
  private postCount = 0
  private nextLongPause: number
  private rafId: number | null = null
  private stuckCount = 0
  onWaitTime: ((seconds: number) => void) | null = null
  onLog: ((text: string) => void) | null = null

  constructor() {
    this.nextLongPause = this.randomInt(
      SCROLL_CONFIG.longPauseEveryMin,
      SCROLL_CONFIG.longPauseEveryMax,
    )
  }

  /** 開始自動滾動 */
  async start(targetCount: number) {
    this.running = true
    this.paused = false
    this.postCount = 0
    this.stuckCount = 0

    while (this.running && this.postCount < targetCount) {
      if (this.paused) {
        await this.sleep(500)
        continue
      }

      const postElement = this.getCurrentVisiblePost()
      const readTime = this.calculateReadTime(postElement)
      this.onWaitTime?.(Math.round(readTime / 1000))
      await this.sleep(readTime)

      if (!this.running || this.paused) continue

      const scrollDistance = this.calculateScrollDistance(postElement)
      const beforeY = window.scrollY
      await this.smoothScroll(scrollDistance)
      const afterY = window.scrollY

      // 卡住偵測：滾動前後位置沒變
      if (Math.abs(afterY - beforeY) < 5) {
        this.stuckCount++
        const height = document.documentElement.scrollHeight
        this.onLog?.(`[滾動] 滾動無效 (${this.stuckCount}/${STUCK_THRESHOLD})，scrollY=${Math.round(afterY)}，scrollHeight=${height}`)

        if (this.stuckCount >= STUCK_THRESHOLD) {
          this.onLog?.('[滾動] 偵測到卡住，嘗試恢復...')
          const recovered = await this.recoverFromStuck()
          if (!recovered) {
            this.onLog?.('[滾動] 無法恢復滾動，可能頁面內容未載入')
          }
        }
        continue // 不增加 postCount，重試
      }

      this.stuckCount = 0
      this.postCount++

      if (this.postCount >= this.nextLongPause) {
        const pauseTime = this.randomInt(
          SCROLL_CONFIG.longPauseMin,
          SCROLL_CONFIG.longPauseMax,
        )
        this.onWaitTime?.(Math.round(pauseTime / 1000))
        await this.sleep(pauseTime)
        this.nextLongPause = this.postCount + this.randomInt(
          SCROLL_CONFIG.longPauseEveryMin,
          SCROLL_CONFIG.longPauseEveryMax,
        )
      }
    }
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  stop() {
    this.running = false
    this.paused = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private getCurrentVisiblePost(): HTMLElement | null {
    const posts = document.querySelectorAll(SELECTORS.postContainer)
    const viewportCenter = window.innerHeight / 2

    for (const post of posts) {
      const rect = post.getBoundingClientRect()
      if (rect.top < viewportCenter && rect.bottom > viewportCenter) {
        return post as HTMLElement
      }
    }

    return null
  }

  private calculateReadTime(element: HTMLElement | null): number {
    if (!element) return 2000

    const text = element.textContent ?? ''
    const charCount = text.length

    const readingSpeed = this.randomInt(
      SCROLL_CONFIG.readingSpeedMin,
      SCROLL_CONFIG.readingSpeedMax,
    )

    const readTime = (charCount / readingSpeed) * 60 * 1000
    return Math.max(1500, Math.min(8000, readTime))
  }

  private calculateScrollDistance(element: HTMLElement | null): number {
    if (!element) return window.innerHeight * 0.7

    const rect = element.getBoundingClientRect()
    return rect.height + this.randomInt(20, 60)
  }

  private smoothScroll(distance: number): Promise<void> {
    return new Promise((resolve) => {
      const start = window.scrollY
      const duration = this.randomInt(400, 800)
      const startTime = performance.now()

      const step = (currentTime: number) => {
        if (!this.running) {
          resolve()
          return
        }

        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        window.scrollTo(0, start + distance * ease)

        if (progress < 1) {
          this.rafId = requestAnimationFrame(step)
        } else {
          this.rafId = null
          resolve()
        }
      }

      this.rafId = requestAnimationFrame(step)
    })
  }

  /**
   * 卡住恢復：先往上捲一小段觸發 Threads 載入更多內容，再等新內容出現
   */
  private async recoverFromStuck(): Promise<boolean> {
    const heightBefore = document.documentElement.scrollHeight
    const scrollBefore = window.scrollY

    // 策略 1：往上捲一點再回來（觸發 Threads infinite scroll）
    window.scrollBy(0, -200)
    await this.sleep(300)
    window.scrollTo(0, scrollBefore)
    await this.sleep(500)

    // 策略 2：觸發一次滾動到底部附近（讓 Threads 載入新內容）
    window.scrollTo(0, document.documentElement.scrollHeight)
    await this.sleep(500)

    // 等待 scrollHeight 增加（Threads 載入新貼文）
    const deadline = Date.now() + STUCK_WAIT_MS
    while (Date.now() < deadline && this.running) {
      const currentHeight = document.documentElement.scrollHeight
      if (currentHeight > heightBefore + 100) {
        this.onLog?.(`[滾動] 恢復成功，新高度 ${currentHeight}（+${currentHeight - heightBefore}）`)
        this.stuckCount = 0
        return true
      }
      await this.sleep(300)
    }

    // 策略 3：滾動到最後一個貼文容器
    const posts = document.querySelectorAll(SELECTORS.postContainer)
    const lastPost = posts[posts.length - 1]
    if (lastPost) {
      lastPost.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await this.sleep(500)
      if (Math.abs(window.scrollY - scrollBefore) > 5) {
        this.onLog?.('[滾動] 使用 scrollIntoView 恢復')
        this.stuckCount = 0
        return true
      }
    }

    this.stuckCount = 0
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
