import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ScanProgress } from '../../shared/types'

@customElement('progress-bar')
export class ProgressBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .progress-track {
      background: var(--c-surface, #f8fafc);
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--c-primary, #6366f1), var(--c-primary-light, #a78bfa));
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 4px;
      background: var(--c-surface, #f8fafc);
      border-radius: var(--radius-sm, 6px);
    }

    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--c-text, #0f172a);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--c-text-tertiary, #94a3b8);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .status {
      text-align: center;
      font-size: 12px;
      color: var(--c-text-secondary, #64748b);
      padding: 4px 0;
    }

    .status.error {
      color: var(--c-error, #ef4444);
      background: var(--c-error-soft, rgba(239, 68, 68, 0.1));
      border-radius: var(--radius-sm, 6px);
      padding: 6px 10px;
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
      <div class="progress-track">
        <div class="progress-fill" style="width: ${this.percentage}%"></div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-value">${scanned}</span>
          <span class="stat-label">掃描 / ${total}</span>
        </div>
        <div class="stat">
          <span class="stat-value">${filtered}</span>
          <span class="stat-label">相關</span>
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
