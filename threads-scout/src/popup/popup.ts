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
      padding: 16px;
    }

    h1 {
      font-size: 18px;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 16px;
    }

    .field {
      margin-bottom: 12px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #333;
    }

    input, textarea, select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus, textarea:focus, select:focus {
      border-color: #0a7cff;
    }

    textarea {
      resize: vertical;
      min-height: 60px;
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
      gap: 8px;
    }

    .slider-row input[type="range"] {
      flex: 1;
      padding: 0;
    }

    .slider-value {
      font-size: 13px;
      font-weight: 600;
      min-width: 32px;
      text-align: right;
    }

    button {
      width: 100%;
      padding: 10px;
      background: #0a7cff;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #0066dd;
    }

    .saved {
      text-align: center;
      color: #00b341;
      font-size: 12px;
      margin-top: 8px;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .saved.show {
      opacity: 1;
    }

    .open-panel {
      margin-top: 8px;
      background: transparent;
      color: #0a7cff;
      border: 1px solid #0a7cff;
    }

    .open-panel:hover {
      background: #f0f7ff;
    }
  `

  @state() private settings: UserSettings = { ...DEFAULT_SETTINGS }
  @state() private saved = false

  async connectedCallback() {
    super.connectedCallback()
    this.settings = await getSettings()
  }

  private async handleSave() {
    await saveSettings(this.settings)
    // 當產品描述變更時清除 embedding 快取，讓下次重新計算
    await clearProductEmbedding()
    this.saved = true
    setTimeout(() => { this.saved = false }, 2000)
  }

  private async openSidePanel() {
    // 開啟 Side Panel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }

  render() {
    return html`
      <h1>Threads Scout</h1>
      <p class="subtitle">自動探索 Threads 推廣機會</p>

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
        <label>Embedding 相似度閾值</label>
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

      <button @click=${this.handleSave}>儲存設定</button>
      <div class="saved ${this.saved ? 'show' : ''}">設定已儲存</div>

      <button class="open-panel" @click=${this.openSidePanel}>開啟掃描面板</button>
    `
  }
}
