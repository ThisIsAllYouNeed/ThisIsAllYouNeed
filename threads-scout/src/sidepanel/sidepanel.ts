import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { ScanProgress, Recommendation } from '../shared/types'
import type { ExtensionMessage } from '../shared/messages'
import './components/scan-control'
import './components/progress-bar'
import './components/result-card'
import './components/activity-log'
import type { ActivityLog } from './components/activity-log'

@customElement('threads-scout-panel')
export class ThreadsScoutPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .logo {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm, 6px);
      background: linear-gradient(135deg, var(--c-primary, #6366f1), var(--c-primary-light, #a78bfa));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }

    h1 {
      font-size: 16px;
      font-weight: 700;
      color: var(--c-text, #0f172a);
      letter-spacing: -0.01em;
    }

    .results-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--c-text-tertiary, #94a3b8);
      margin-top: 16px;
      margin-bottom: 10px;
    }

    .results {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .empty {
      text-align: center;
      color: var(--c-text-tertiary, #94a3b8);
      padding: 40px 20px;
      font-size: 13px;
      line-height: 1.6;
      background: var(--c-surface, #f8fafc);
      border-radius: var(--radius-md, 10px);
      border: 1px dashed var(--c-border, #e2e8f0);
    }
  `

  @state() private progress: ScanProgress = {
    status: 'idle',
    scanned: 0,
    filtered: 0,
    analyzed: 0,
    total: 50,
  }

  @state() private recommendations: Recommendation[] = []
  private port: chrome.runtime.Port | null = null

  private alive = true
  private retryCount = 0

  connectedCallback() {
    super.connectedCallback()
    this.alive = true
    this.retryCount = 0
    this.connectPort()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.alive = false
    this.port?.disconnect()
  }

  private connectPort() {
    if (!this.alive) return
    try {
      this.port = chrome.runtime.connect({ name: 'sidepanel' })
      this.retryCount = 0
      this.port.onMessage.addListener((msg: ExtensionMessage) => {
        switch (msg.type) {
          case 'PROGRESS_UPDATE':
            this.progress = msg.progress
            break
          case 'RECOMMENDATION':
            this.recommendations = [...this.recommendations, ...msg.recommendations]
            break
          case 'ERROR':
            this.progress = { ...this.progress, status: 'error', error: msg.error }
            this.log(msg.error)
            break
          case 'LOG':
            this.log(msg.text)
            break
        }
      })
      this.port.onDisconnect.addListener(() => {
        this.port = null
        this.scheduleReconnect()
      })
    } catch {
      this.port = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (!this.alive || this.retryCount >= 5) return
    const delay = Math.min(1000 * 2 ** this.retryCount, 30000)
    this.retryCount++
    setTimeout(() => this.connectPort(), delay)
  }

  private sendMessage(msg: Record<string, unknown>) {
    try {
      this.port?.postMessage(msg)
    } catch {
      // Port 斷線，等待自動重連
      this.port = null
    }
  }

  private log(text: string) {
    const el = this.shadowRoot?.querySelector('activity-log') as ActivityLog | null
    el?.addEntry(text)
  }

  private handleControl(e: CustomEvent<'start' | 'pause' | 'resume' | 'stop'>) {
    const action = e.detail
    const msgMap = {
      start: 'REQUEST_START',
      pause: 'REQUEST_PAUSE',
      resume: 'REQUEST_RESUME',
      stop: 'REQUEST_STOP',
    } as const
    this.sendMessage({ type: msgMap[action] })
  }

  render() {
    return html`
      <div class="header">
        <div class="logo">TS</div>
        <h1>Threads Scout</h1>
      </div>

      <scan-control
        .status=${this.progress.status}
        @control=${this.handleControl}
      ></scan-control>

      <progress-bar .progress=${this.progress}></progress-bar>

      <activity-log></activity-log>

      ${this.recommendations.length > 0 ? html`
        <div class="results-header">推薦結果 (${this.recommendations.length})</div>
      ` : ''}

      <div class="results">
        ${this.recommendations.length === 0 && this.progress.status === 'idle'
          ? html`<div class="empty">設定完成後，點擊「開始掃描」<br/>來探索 Threads 推廣機會</div>`
          : this.recommendations.map(
              r => html`<result-card .recommendation=${r}></result-card>`
            )}
      </div>
    `
  }
}
