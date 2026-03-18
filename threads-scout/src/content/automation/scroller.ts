import { SCROLL_CONFIG } from '../../shared/constants'
import { SELECTORS } from '../selectors/config'

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
  onWaitTime: ((seconds: number) => void) | null = null

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
      await this.smoothScroll(scrollDistance)

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
