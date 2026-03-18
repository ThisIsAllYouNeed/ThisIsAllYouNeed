import { SCROLL_CONFIG } from '../../shared/constants'

/**
 * 智慧滾動引擎
 * 依貼文內容長度決定停留時間和滾動距離，模擬真實閱讀行為
 */
export class SmartScroller {
  private running = false
  private paused = false
  private postCount = 0
  private nextLongPause: number

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

      // 取得目前可見的貼文元素
      const postElement = this.getCurrentVisiblePost()

      // 計算停留時間（依內容長度）
      const readTime = this.calculateReadTime(postElement)
      await this.sleep(readTime)

      if (!this.running || this.paused) continue

      // 滾動到下一篇
      const scrollDistance = this.calculateScrollDistance(postElement)
      await this.smoothScroll(scrollDistance)

      this.postCount++

      // 每 N 篇加入長暫停
      if (this.postCount >= this.nextLongPause) {
        const pauseTime = this.randomInt(
          SCROLL_CONFIG.longPauseMin,
          SCROLL_CONFIG.longPauseMax,
        )
        await this.sleep(pauseTime)
        this.nextLongPause = this.postCount + this.randomInt(
          SCROLL_CONFIG.longPauseEveryMin,
          SCROLL_CONFIG.longPauseEveryMax,
        )
      }
    }
  }

  /** 暫停滾動 */
  pause() {
    this.paused = true
  }

  /** 繼續滾動 */
  resume() {
    this.paused = false
  }

  /** 停止滾動 */
  stop() {
    this.running = false
    this.paused = false
  }

  /** 取得目前視窗中可見的貼文元素 */
  private getCurrentVisiblePost(): HTMLElement | null {
    const posts = document.querySelectorAll('[data-pressable-container]')
    const viewportCenter = window.innerHeight / 2

    for (const post of posts) {
      const rect = post.getBoundingClientRect()
      if (rect.top < viewportCenter && rect.bottom > viewportCenter) {
        return post as HTMLElement
      }
    }

    return null
  }

  /** 依內容長度計算閱讀停留時間（毫秒） */
  private calculateReadTime(element: HTMLElement | null): number {
    if (!element) return 2000

    const text = element.textContent ?? ''
    const charCount = text.length

    // 中文約 300-500 字/分鐘，加隨機偏移
    const readingSpeed = this.randomInt(
      SCROLL_CONFIG.readingSpeedMin,
      SCROLL_CONFIG.readingSpeedMax,
    )

    // 閱讀時間（毫秒），最少 1.5 秒，最多 8 秒
    const readTime = (charCount / readingSpeed) * 60 * 1000
    return Math.max(1500, Math.min(8000, readTime))
  }

  /** 計算滾動距離（貼文 DOM 的實際高度） */
  private calculateScrollDistance(element: HTMLElement | null): number {
    if (!element) return window.innerHeight * 0.7

    const rect = element.getBoundingClientRect()
    // 滾動整個貼文高度，加一點間距
    return rect.height + this.randomInt(20, 60)
  }

  /** 平滑滾動 */
  private smoothScroll(distance: number): Promise<void> {
    return new Promise((resolve) => {
      const start = window.scrollY
      const target = start + distance
      const duration = this.randomInt(400, 800)
      const startTime = performance.now()

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeInOutCubic
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        window.scrollTo(0, start + distance * ease)

        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          resolve()
        }
      }

      requestAnimationFrame(step)
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
