import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ScanProgress } from '../../shared/types'

@customElement('progress-bar')
export class ProgressBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .progress-container {
      background: #f0f0f0;
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: #0a7cff;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .stats {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .stat-label {
      font-size: 11px;
      color: #999;
    }

    .status {
      text-align: center;
      font-size: 12px;
      margin-top: 8px;
      color: #666;
    }

    .status.error {
      color: #ff3b30;
    }
  `

  @property({ type: Object }) progress: ScanProgress = {
    status: 'idle',
    scanned: 0,
    filtered: 0,
    analyzed: 0,
    total: 50,
  }

  private startTime: number | null = null
  private elapsed = 0
  private timerId: ReturnType<typeof setInterval> | null = null

  updated(changed: Map<string, unknown>) {
    if (changed.has('progress')) {
      const status = this.progress.status
      const isActive = status === 'scanning' || status === 'analyzing'

      if (isActive && !this.timerId) {
        this.startTime = Date.now()
        this.elapsed = 0
        this.timerId = setInterval(() => {
          this.elapsed = Math.floor((Date.now() - this.startTime!) / 1000)
          this.requestUpdate()
        }, 1000)
      } else if (!isActive && this.timerId) {
        clearInterval(this.timerId)
        this.timerId = null
      }

      if (status === 'idle') {
        this.startTime = null
        this.elapsed = 0
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private formatElapsed(): string {
    const min = Math.floor(this.elapsed / 60)
    const sec = this.elapsed % 60
    return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`
  }

  private get percentage(): number {
    if (this.progress.total === 0) return 0
    return Math.round((this.progress.scanned / this.progress.total) * 100)
  }

  private get statusText(): string {
    const time = this.elapsed > 0 ? ` (${this.formatElapsed()})` : ''
    const wait = this.progress.currentWaitSec
    const waitText = wait && this.progress.status === 'scanning' ? `，等待 ${wait}s` : ''
    const map: Record<string, string> = {
      idle: '等待開始',
      scanning: `掃描中...${time}${waitText}`,
      paused: `已暫停${time}`,
      analyzing: `LLM 分析中...${time}`,
      done: `完成${time}`,
      error: this.progress.error ?? '發生錯誤',
    }
    return map[this.progress.status] ?? ''
  }

  render() {
    const { scanned, filtered, analyzed, total } = this.progress

    return html`
      <div class="progress-container">
        <div class="progress-fill" style="width: ${this.percentage}%"></div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-value">${scanned}</span>
          <span class="stat-label">已掃描 / ${total}</span>
        </div>
        <div class="stat">
          <span class="stat-value">${filtered}</span>
          <span class="stat-label">相關貼文</span>
        </div>
        <div class="stat">
          <span class="stat-value">${analyzed}</span>
          <span class="stat-label">已分析</span>
        </div>
      </div>

      <div class="status ${this.progress.status === 'error' ? 'error' : ''}">
        ${this.statusText}
      </div>
    `
  }
}
