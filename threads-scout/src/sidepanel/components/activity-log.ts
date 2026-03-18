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
      padding: 8px 10px;
      border-radius: var(--radius-sm, 6px);
      transition: background 0.15s;
    }

    .header:hover {
      background: var(--c-surface-hover, #f1f5f9);
    }

    .title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--c-text-tertiary, #94a3b8);
    }

    .toggle {
      font-size: 10px;
      color: var(--c-text-tertiary, #94a3b8);
    }

    .log-container {
      max-height: 200px;
      overflow-y: auto;
      background: var(--c-surface, #f8fafc);
      border: 1px solid var(--c-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      padding: 10px;
      margin-top: 4px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      line-height: 1.7;
    }

    .log-container::-webkit-scrollbar {
      width: 4px;
    }

    .log-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .log-container::-webkit-scrollbar-thumb {
      background: var(--c-border, #e2e8f0);
      border-radius: 2px;
    }

    .entry {
      color: var(--c-text-secondary, #64748b);
      word-break: break-all;
    }

    .time {
      color: var(--c-text-tertiary, #94a3b8);
      margin-right: 6px;
    }

    .empty {
      color: var(--c-text-tertiary, #94a3b8);
      font-style: italic;
      font-family: var(--font-sans, sans-serif);
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
        <span class="toggle">${this.collapsed ? '▼ 展開' : '▲ 收合'}</span>
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
