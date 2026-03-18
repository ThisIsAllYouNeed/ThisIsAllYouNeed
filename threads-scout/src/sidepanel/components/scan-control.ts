import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ScanStatus } from '../../shared/types'

@customElement('scan-control')
export class ScanControl extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-bottom: 12px;
    }

    .controls {
      display: flex;
      gap: 8px;
    }

    button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .start {
      background: #0a7cff;
      color: white;
    }

    .start:hover:not(:disabled) {
      background: #0066dd;
    }

    .pause {
      background: #ff9500;
      color: white;
    }

    .pause:hover:not(:disabled) {
      background: #e68600;
    }

    .stop {
      background: #ff3b30;
      color: white;
    }

    .stop:hover:not(:disabled) {
      background: #e6352b;
    }

    .resume {
      background: #00b341;
      color: white;
    }

    .resume:hover:not(:disabled) {
      background: #009936;
    }
  `

  @property() status: ScanStatus = 'idle'

  private emit(action: 'start' | 'pause' | 'resume' | 'stop') {
    this.dispatchEvent(new CustomEvent('control', { detail: action, bubbles: true, composed: true }))
  }

  render() {
    const { status } = this

    if (status === 'idle' || status === 'done' || status === 'error') {
      return html`
        <div class="controls">
          <button class="start" @click=${() => this.emit('start')}>開始掃描</button>
        </div>
      `
    }

    if (status === 'paused') {
      return html`
        <div class="controls">
          <button class="resume" @click=${() => this.emit('resume')}>繼續</button>
          <button class="stop" @click=${() => this.emit('stop')}>停止</button>
        </div>
      `
    }

    // scanning / analyzing
    return html`
      <div class="controls">
        <button class="pause" @click=${() => this.emit('pause')}>暫停</button>
        <button class="stop" @click=${() => this.emit('stop')}>停止</button>
      </div>
    `
  }
}
