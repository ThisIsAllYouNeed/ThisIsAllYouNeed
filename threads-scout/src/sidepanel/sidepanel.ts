import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { ScanProgress, Recommendation } from '../shared/types'
import type { ExtensionMessage } from '../shared/messages'
import './components/scan-control'
import './components/progress-bar'
import './components/result-card'

@customElement('threads-scout-panel')
export class ThreadsScoutPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }

    h1 {
      font-size: 16px;
      margin-bottom: 12px;
    }

    .results {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
    }

    .empty {
      text-align: center;
      color: #999;
      padding: 32px 16px;
      font-size: 13px;
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
      <h1>Threads Scout</h1>

      <scan-control
        .status=${this.progress.status}
        @control=${this.handleControl}
      ></scan-control>

      <progress-bar .progress=${this.progress}></progress-bar>

      <div class="results">
        ${this.recommendations.length === 0 && this.progress.status === 'idle'
          ? html`<div class="empty">設定完成後，點擊「開始掃描」來探索 Threads 推廣機會</div>`
          : this.recommendations.map(
              r => html`<result-card .recommendation=${r}></result-card>`
            )}
      </div>
    `
  }
}
