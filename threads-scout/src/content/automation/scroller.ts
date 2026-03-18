import { SCROLL_CONFIG, INTEREST_PROFILES, REVISIT_CONFIG } from '../../shared/constants'
import type { InterestProfile } from '../../shared/constants'
import { SELECTORS } from '../selectors/config'

/** 卡住偵測：連續幾次滾動無效後觸發恢復 */
const STUCK_THRESHOLD = 3
/** 卡住恢復：等待新內容載入的最長時間（毫秒） */
const STUCK_WAIT_MS = 5000

/**
 * 智慧滾動引擎
 * 根據興趣分數選擇不同行為設定檔，逐 tick 捲動模擬真實閱讀
 */
export class SmartScroller {
  private running = false
  private paused = false
  private postCount = 0
  private nextLongPause: number
  private rafId: number | null = null
  private stuckCount = 0

  // 興趣分數
  private interestScores = new Map<string, number>()
  private interestResolvers = new Map<string, (score: number) => void>()

  // 回訪佇列
  private revisitQueue: { scrollY: number; postUrl: string }[] = []
  private postsSinceLastRevisit = 0
  private nextRevisitAt: number

  onWaitTime: ((seconds: number) => void) | null = null
  onLog: ((text: string) => void) | null = null
  onRecoverPage: (() => Promise<boolean>) | null = null
  onRequestReplies: ((element: HTMLElement) => Promise<void>) | null = null

  constructor() {
    this.nextLongPause = this.randomInt(
      SCROLL_CONFIG.longPauseEveryMin,
      SCROLL_CONFIG.longPauseEveryMax,
    )
    this.nextRevisitAt = this.randomInt(
      REVISIT_CONFIG.postsBeforeRevisitMin,
      REVISIT_CONFIG.postsBeforeRevisitMax,
    )
  }

  /** 外部呼叫：收到 service worker 回傳的 interest score */
  notifyInterest(postUrl: string, score: number): void {
    this.interestScores.set(postUrl, score)
    this.interestResolvers.get(postUrl)?.(score)
    this.interestResolvers.delete(postUrl)
  }

  /** 開始自動滾動 */
  async start(targetCount: number, similarityThreshold: number) {
    this.running = true
    this.paused = false
    this.postCount = 0
    this.stuckCount = 0
    this.interestScores.clear()
    this.interestResolvers.clear()
    this.revisitQueue = []
    this.postsSinceLastRevisit = 0

    while (this.running && this.postCount < targetCount) {
      if (this.paused) {
        await this.sleep(500)
        continue
      }

      const posts = this.getPostsSnapshot()
      const element = this.getCurrentVisiblePost(posts)
      const postUrl = this.extractPostUrl(element)

      // 等待 similarity score（最多 2 秒，超時用 -1 → low profile）
      const score = postUrl
        ? await this.waitForInterest(postUrl, 2000)
        : -1
      const profile = score >= similarityThreshold
        ? INTEREST_PROFILES.high
        : INTEREST_PROFILES.low

      // tick-by-tick 閱讀
      await this.readPostWithTicks(element, profile)

      if (!this.running || this.paused) continue

      // 條件式留言抓取
      if (element && Math.random() < profile.enterRepliesProb) {
        await this.onRequestReplies?.(element)
      }

      if (!this.running || this.paused) continue

      // 標記回訪（佇列滿時丟棄最舊的）
      if (profile.markForRevisit && postUrl) {
        if (this.revisitQueue.length >= REVISIT_CONFIG.maxQueueSize) {
          this.revisitQueue.shift()
        }
        this.revisitQueue.push({ scrollY: window.scrollY, postUrl })
      }

      // 捲到下一篇（重新查詢以反映 tick 捲動後的 DOM 變化）
      const scrollDistance = this.calculateScrollDistance(element, this.getPostsSnapshot())
      const beforeY = window.scrollY
      await this.smoothScroll(scrollDistance)
      const afterY = window.scrollY

      // 卡住偵測
      if (Math.abs(afterY - beforeY) < 5) {
        this.stuckCount++
        const height = document.documentElement.scrollHeight
        this.onLog?.(`[滾動] 滾動無效 (${this.stuckCount}/${STUCK_THRESHOLD})，scrollY=${Math.round(afterY)}，scrollHeight=${height}`)

        if (this.stuckCount >= STUCK_THRESHOLD) {
          this.onLog?.('[滾動] 偵測到卡住，嘗試恢復...')
          await this.recoverFromStuck()
        }
        continue
      }

      this.stuckCount = 0
      this.postCount++
      this.postsSinceLastRevisit++

      // 回訪檢查
      if (this.revisitQueue.length > 0 && this.postsSinceLastRevisit >= this.nextRevisitAt) {
        const bookmark = this.revisitQueue.shift()
        if (bookmark && Math.random() < REVISIT_CONFIG.revisitProb) {
          await this.revisitPost(bookmark)
          this.postsSinceLastRevisit = 0
          this.nextRevisitAt = this.randomInt(
            REVISIT_CONFIG.postsBeforeRevisitMin,
            REVISIT_CONFIG.postsBeforeRevisitMax,
          )
        }
      }

      // 長暫停
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
    // 清除待處理的 interest resolvers
    for (const resolver of this.interestResolvers.values()) {
      resolver(-1)
    }
    this.interestResolvers.clear()
  }

  private waitForInterest(postUrl: string, timeoutMs: number): Promise<number> {
    const existing = this.interestScores.get(postUrl)
    if (existing !== undefined) {
      this.interestScores.delete(postUrl)
      return Promise.resolve(existing)
    }

    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        this.interestResolvers.delete(postUrl)
        resolve(-1)
      }, timeoutMs)
      this.interestResolvers.set(postUrl, (score) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.interestScores.delete(postUrl)
        resolve(score)
      })
    })
  }

  private async readPostWithTicks(
    element: HTMLElement | null,
    profile: InterestProfile,
  ): Promise<void> {
    if (!element) {
      await this.sleep(this.randomInt(profile.tickPauseMin, profile.tickPauseMax))
      return
    }

    const postHeight = element.getBoundingClientRect().height
    const avgTickSize = window.innerHeight *
      (profile.tickSizeMin + profile.tickSizeMax) / 2
    const tickCount = Math.max(1, Math.round(postHeight / avgTickSize))

    // 估算總閱讀時間，只發送一次
    const avgPause = (profile.tickPauseMin + profile.tickPauseMax) / 2
    this.onWaitTime?.(Math.round(tickCount * avgPause / 1000))

    for (let i = 0; i < tickCount && this.running && !this.paused; i++) {
      const pause = this.randomInt(profile.tickPauseMin, profile.tickPauseMax)
      await this.sleep(pause)

      const goDown = Math.random() < profile.downwardProb
      const tickSize = window.innerHeight *
        (profile.tickSizeMin + Math.random() *
          (profile.tickSizeMax - profile.tickSizeMin))
      const distance = goDown ? tickSize : -tickSize * 0.5

      await this.smoothScroll(distance)
    }
  }

  private async revisitPost(
    bookmark: { scrollY: number; postUrl: string },
  ): Promise<void> {
    const returnY = window.scrollY

    this.onLog?.(`[回訪] 回捲到先前感興趣的貼文 → ${bookmark.postUrl}`)
    await this.smoothScroll(bookmark.scrollY - returnY)

    const pause = this.randomInt(
      REVISIT_CONFIG.revisitPauseMin,
      REVISIT_CONFIG.revisitPauseMax,
    )
    this.onWaitTime?.(Math.round(pause / 1000))
    await this.sleep(pause)

    this.onLog?.('[回訪] 返回繼續瀏覽')
    await this.smoothScroll(returnY - window.scrollY)
  }

  private extractPostUrl(element: HTMLElement | null): string | null {
    if (!element) return null
    const link = element.querySelector(SELECTORS.permalink) as HTMLAnchorElement | null
    return link?.href ?? null
  }

  private getPostsSnapshot(): NodeListOf<Element> {
    return document.querySelectorAll(SELECTORS.postContainer)
  }

  private getCurrentVisiblePost(posts: NodeListOf<Element>): HTMLElement | null {
    const targetY = window.innerHeight * SCROLL_CONFIG.scrollTargetRatio

    let closest: HTMLElement | null = null
    let closestDist = Infinity

    for (const post of posts) {
      const rect = post.getBoundingClientRect()

      if (rect.top <= targetY && rect.bottom > targetY) {
        return post as HTMLElement
      }

      if (rect.top >= 0 && rect.top < window.innerHeight) {
        const dist = Math.abs(rect.top - targetY)
        if (dist < closestDist) {
          closestDist = dist
          closest = post as HTMLElement
        }
      }
    }
    return closest
  }

  private calculateScrollDistance(element: HTMLElement | null, posts: NodeListOf<Element>): number {
    const targetY = window.innerHeight * SCROLL_CONFIG.scrollTargetRatio

    if (!element) return window.innerHeight * 0.7

    const rect = element.getBoundingClientRect()
    let nextTop: number | null = null
    for (const post of posts) {
      if (element.contains(post) || post.contains(element)) continue
      const r = post.getBoundingClientRect()
      if (r.top > rect.bottom - 5) {
        nextTop = r.top
        break
      }
    }

    const distance = nextTop !== null
      ? nextTop - targetY + this.randomInt(-5, 10)
      : rect.bottom - targetY + SCROLL_CONFIG.postGapEstimate

    const maxScroll = window.innerHeight * (1 - SCROLL_CONFIG.scrollTargetRatio)
    return Math.max(SCROLL_CONFIG.minScrollDistance, Math.min(maxScroll, distance))
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

  private async recoverFromStuck(): Promise<boolean> {
    if (this.onRecoverPage) {
      const recovered = await this.onRecoverPage()
      if (recovered) {
        this.stuckCount = 0
        return true
      }
    }

    const heightBefore = document.documentElement.scrollHeight
    const scrollBefore = window.scrollY

    window.scrollBy(0, -200)
    await this.sleep(300)
    window.scrollTo(0, scrollBefore)
    await this.sleep(500)

    window.scrollTo(0, document.documentElement.scrollHeight)
    await this.sleep(500)

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
