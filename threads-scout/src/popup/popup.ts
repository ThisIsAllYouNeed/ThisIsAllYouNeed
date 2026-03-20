import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { UserSettings } from '../shared/types'
import { getSettings } from '../shared/storage'
import { DEFAULT_SETTINGS } from '../shared/constants'

@customElement('threads-scout-popup')
export class ThreadsScoutPopup extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 20px;
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
      font-size: 17px;
      font-weight: 700;
      color: var(--c-text, #0f172a);
      letter-spacing: -0.01em;
    }

    .status-card {
      background: var(--c-surface, #f8fafc);
      border-radius: var(--radius-md, 10px);
      padding: 14px;
      margin-bottom: 16px;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--c-text-secondary, #64748b);
    }

    .status-row + .status-row {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--c-border, #e2e8f0);
    }

    .status-label {
      font-weight: 500;
    }

    .status-value {
      font-weight: 600;
      color: var(--c-text, #0f172a);
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-ok {
      color: var(--c-success, #10b981);
    }

    .status-warn {
      color: var(--c-warning, #f59e0b);
    }

    .btn {
      width: 100%;
      padding: 11px;
      border: none;
      border-radius: var(--radius-sm, 6px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--c-primary, #6366f1);
      color: var(--c-primary-text, #ffffff);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    }

    .btn-primary:hover {
      background: var(--c-primary-hover, #4f46e5);
      box-shadow: var(--shadow-md);
    }

    .btn-ghost {
      background: transparent;
      color: var(--c-primary, #6366f1);
      border: 1.5px solid var(--c-border, #e2e8f0);
    }

    .btn-ghost:hover {
      background: var(--c-primary-soft, rgba(99, 102, 241, 0.08));
      border-color: var(--c-primary, #6366f1);
    }

    .btn + .btn {
      margin-top: 8px;
    }
  `

  @state() private settings: UserSettings = { ...DEFAULT_SETTINGS }

  async connectedCallback() {
    super.connectedCallback()
    this.settings = await getSettings()
  }

  private async openSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }

  private openSettings() {
    chrome.runtime.openOptionsPage()
  }

  render() {
    const hasKey = !!this.settings.apiKey
    const hasProduct = !!this.settings.productName

    return html`
      <div class="header">
        <div class="logo">TS</div>
        <h1>Threads Scout</h1>
      </div>

      <div class="status-card">
        <div class="status-row">
          <span class="status-label">API Key</span>
          <span class="status-value ${hasKey ? 'status-ok' : 'status-warn'}">
            ${hasKey ? '已設定' : '未設定'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">產品</span>
          <span class="status-value ${hasProduct ? 'status-ok' : 'status-warn'}">
            ${hasProduct ? this.settings.productName : '未設定'}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">目標數量</span>
          <span class="status-value">${this.settings.targetCount} 篇</span>
        </div>
      </div>

      <button class="btn btn-primary" @click=${this.openSidePanel}>開啟掃描面板</button>
      <button class="btn btn-ghost" @click=${this.openSettings}>設定</button>
    `
  }
}
