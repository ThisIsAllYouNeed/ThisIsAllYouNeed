import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { UserSettings } from '../shared/types'
import { getSettings, saveSettings, clearProductEmbedding } from '../shared/storage'
import { DEFAULT_SETTINGS, AVAILABLE_MODELS } from '../shared/constants'

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
      margin-bottom: 6px;
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

    .subtitle {
      font-size: 12px;
      color: var(--c-text-tertiary, #94a3b8);
      margin-bottom: 20px;
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--c-text-tertiary, #94a3b8);
      margin-bottom: 10px;
    }

    .field {
      margin-bottom: 14px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 5px;
      color: var(--c-text-secondary, #64748b);
    }

    input, textarea, select {
      width: 100%;
      padding: 9px 12px;
      border: 1.5px solid var(--c-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      font-size: 13px;
      font-family: inherit;
      color: var(--c-text, #0f172a);
      background: var(--c-bg, #ffffff);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, textarea:focus, select:focus {
      border-color: var(--c-primary, #6366f1);
      box-shadow: 0 0 0 3px var(--c-primary-soft, rgba(99, 102, 241, 0.08));
    }

    input::placeholder, textarea::placeholder {
      color: var(--c-text-tertiary, #94a3b8);
    }

    textarea {
      resize: vertical;
      min-height: 64px;
      line-height: 1.5;
    }

    .row {
      display: flex;
      gap: 12px;
    }

    .row .field {
      flex: 1;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .slider-row input[type="range"] {
      flex: 1;
      padding: 0;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--c-border, #e2e8f0);
      border: none;
      border-radius: 3px;
      outline: none;
    }

    .slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--c-primary, #6366f1);
      cursor: pointer;
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    }

    .slider-value {
      font-size: 13px;
      font-weight: 700;
      color: var(--c-primary, #6366f1);
      min-width: 36px;
      text-align: right;
      font-family: var(--font-mono, monospace);
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--c-surface, #f8fafc);
      border-radius: var(--radius-sm, 6px);
      cursor: pointer;
    }

    .toggle-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--c-text, #0f172a);
    }

    /* 自訂 toggle switch */
    .switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
      pointer-events: none;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .switch input:focus-visible + .switch-track {
      outline: 2px solid var(--c-primary, #6366f1);
      outline-offset: 2px;
    }

    .switch-track {
      position: absolute;
      inset: 0;
      background: var(--c-border, #e2e8f0);
      border-radius: 10px;
      transition: background 0.2s;
      cursor: pointer;
    }

    .switch input:checked + .switch-track {
      background: var(--c-primary, #6366f1);
    }

    .switch-track::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .switch input:checked + .switch-track::after {
      transform: translateX(16px);
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

    .toast {
      text-align: center;
      font-size: 12px;
      font-weight: 500;
      margin-top: 10px;
      padding: 6px;
      border-radius: var(--radius-sm, 6px);
      background: var(--c-success-soft, rgba(16, 185, 129, 0.1));
      color: var(--c-success, #10b981);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .toast.show {
      opacity: 1;
    }
  `

  @state() private settings: UserSettings = { ...DEFAULT_SETTINGS }
  @state() private saved = false
  private previousProductDescription = ''

  async connectedCallback() {
    super.connectedCallback()
    this.settings = await getSettings()
    this.previousProductDescription = this.settings.productDescription
  }

  private async handleSave() {
    await saveSettings(this.settings)
    // 只在產品描述變更時清除 embedding 快取
    if (this.settings.productDescription !== this.previousProductDescription) {
      await clearProductEmbedding()
      this.previousProductDescription = this.settings.productDescription
    }
    this.saved = true
    setTimeout(() => { this.saved = false }, 2000)
  }

  private async openSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }

  render() {
    return html`
      <div class="header">
        <div class="logo">TS</div>
        <h1>Threads Scout</h1>
      </div>
      <p class="subtitle">自動探索 Threads 推廣機會</p>

      <div class="section">
        <div class="section-title">API 設定</div>
        <div class="field">
          <label>OpenRouter API Key</label>
          <input
            type="password"
            placeholder="sk-or-..."
            .value=${this.settings.apiKey}
            @input=${(e: Event) => {
              this.settings = { ...this.settings, apiKey: (e.target as HTMLInputElement).value }
            }}
          />
        </div>
      </div>

      <div class="section">
        <div class="section-title">產品資訊</div>
        <div class="field">
          <label>產品名稱</label>
          <input
            type="text"
            placeholder="例：智能收納盒"
            .value=${this.settings.productName}
            @input=${(e: Event) => {
              this.settings = { ...this.settings, productName: (e.target as HTMLInputElement).value }
            }}
          />
        </div>

        <div class="field">
          <label>產品描述</label>
          <textarea
            placeholder="描述你的產品特色、目標客群、想推廣的重點..."
            .value=${this.settings.productDescription}
            @input=${(e: Event) => {
              this.settings = { ...this.settings, productDescription: (e.target as HTMLTextAreaElement).value }
            }}
          ></textarea>
        </div>
      </div>

      <div class="section">
        <div class="section-title">掃描設定</div>
        <div class="row">
          <div class="field">
            <label>目標貼文數量</label>
            <input
              type="number"
              min="10"
              max="200"
              .value=${String(this.settings.targetCount)}
              @input=${(e: Event) => {
                this.settings = { ...this.settings, targetCount: Number((e.target as HTMLInputElement).value) }
              }}
            />
          </div>
          <div class="field">
            <label>LLM 模型</label>
            <select
              @change=${(e: Event) => {
                this.settings = { ...this.settings, llmModel: (e.target as HTMLSelectElement).value }
              }}
            >
              ${AVAILABLE_MODELS.map(m => html`
                <option value=${m.id} ?selected=${this.settings.llmModel === m.id}>${m.name}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="field">
          <div class="toggle-row" @click=${() => {
            this.settings = { ...this.settings, enablePrefilter: !this.settings.enablePrefilter }
          }}>
            <span class="toggle-label">Embedding 預過濾</span>
            <label class="switch">
              <input type="checkbox" role="switch" aria-label="Embedding 預過濾" .checked=${this.settings.enablePrefilter} />
              <span class="switch-track"></span>
            </label>
          </div>
        </div>

        ${this.settings.enablePrefilter ? html`
          <div class="field">
            <label>相似度閾值</label>
            <div class="slider-row">
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                .value=${String(this.settings.similarityThreshold)}
                @input=${(e: Event) => {
                  this.settings = { ...this.settings, similarityThreshold: Number((e.target as HTMLInputElement).value) }
                }}
              />
              <span class="slider-value">${this.settings.similarityThreshold.toFixed(2)}</span>
            </div>
          </div>
        ` : ''}
      </div>

      <button class="btn btn-primary" @click=${this.handleSave}>儲存設定</button>
      <div class="toast ${this.saved ? 'show' : ''}">設定已儲存</div>

      <button class="btn btn-ghost" @click=${this.openSidePanel}>開啟掃描面板</button>
    `
  }
}
