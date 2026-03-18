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
      border-radius: var(--radius-sm, 6px);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    }

    button:active {
      transform: scale(0.97);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .start {
      background: var(--c-primary, #6366f1);
      color: var(--c-primary-text, #ffffff);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    }

    .start:hover:not(:disabled) {
      background: var(--c-primary-hover, #4f46e5);
      box-shadow: var(--shadow-md);
    }

    .pause {
      background: var(--c-warning-soft, rgba(245, 158, 11, 0.1));
      color: var(--c-warning, #f59e0b);
    }

    .pause:hover:not(:disabled) {
      background: rgba(245, 158, 11, 0.18);
    }

    .stop {
      background: var(--c-error-soft, rgba(239, 68, 68, 0.1));
      color: var(--c-error, #ef4444);
    }

    .stop:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.18);
    }

    .resume {
      background: var(--c-success-soft, rgba(16, 185, 129, 0.1));
      color: var(--c-success, #10b981);
    }

    .resume:hover:not(:disabled) {
      background: rgba(16, 185, 129, 0.18);
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
