import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

interface LogEntry {
  time: string
  text: string
}

@customElement('activity-log')
export class ActivityLog extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-top: 12px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      padding: 6px 0;
    }

    .title {
      font-size: 12px;
      font-weight: 600;
      color: #666;
    }

    .toggle {
      font-size: 10px;
      color: #999;
    }

    .log-container {
      max-height: 200px;
      overflow-y: auto;
      background: #f8f8f8;
      border-radius: 6px;
      padding: 8px;
      font-family: monospace;
      font-size: 11px;
      line-height: 1.6;
    }

    .entry {
      color: #333;
      word-break: break-all;
    }

    .time {
      color: #999;
      margin-right: 4px;
    }

    .empty {
      color: #999;
      font-style: italic;
    }
  `

  @property({ type: Boolean }) active = false
  @state() private entries: LogEntry[] = []
  @state() private collapsed = false

  private maxEntries = 200

  addEntry(text: string) {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    this.entries = [...this.entries.slice(-(this.maxEntries - 1)), { time, text }]
    this.updateComplete.then(() => {
      const container = this.shadowRoot?.querySelector('.log-container')
      if (container) container.scrollTop = container.scrollHeight
    })
  }

  clear() {
    this.entries = []
  }

  render() {
    return html`
      <div class="header" @click=${() => { this.collapsed = !this.collapsed }}>
        <span class="title">活動記錄 (${this.entries.length})</span>
        <span class="toggle">${this.collapsed ? '展開 ▼' : '收合 ▲'}</span>
      </div>
      ${this.collapsed ? '' : html`
        <div class="log-container">
          ${this.entries.length === 0
            ? html`<div class="empty">尚無記錄</div>`
            : this.entries.map(e => html`
              <div class="entry"><span class="time">${e.time}</span>${e.text}</div>
            `)}
        </div>
      `}
    `
  }
}
