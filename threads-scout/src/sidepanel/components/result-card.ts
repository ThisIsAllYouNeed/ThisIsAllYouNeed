import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Recommendation } from '../../shared/types'

@customElement('result-card')
export class ResultCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: white;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 12px;
    }

    .post-link {
      font-size: 12px;
      color: #0a7cff;
      text-decoration: none;
      word-break: break-all;
    }

    .post-link:hover {
      text-decoration: underline;
    }

    .reason {
      font-size: 13px;
      color: #333;
      margin: 8px 0;
      line-height: 1.5;
    }

    .reply-section {
      background: #f8f8f8;
      border-radius: 6px;
      padding: 10px;
      margin-top: 8px;
    }

    .reply-label {
      font-size: 11px;
      font-weight: 600;
      color: #999;
      margin-bottom: 4px;
    }

    .reply-text {
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    button {
      padding: 6px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: white;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #f0f0f0;
    }

    .copied {
      color: #00b341;
      font-size: 12px;
      display: flex;
      align-items: center;
    }

    .target-comment {
      font-size: 11px;
      color: #999;
      margin-top: 4px;
    }
  `

  @property({ type: Object }) recommendation!: Recommendation
  @state() private copied = false

  private async copyReply() {
    await navigator.clipboard.writeText(this.recommendation.suggestedReply)
    this.copied = true
    setTimeout(() => { this.copied = false }, 2000)
  }

  private openPost() {
    const url = this.recommendation.targetUrl || this.recommendation.postUrl
    window.open(url, '_blank')
  }

  render() {
    const r = this.recommendation

    return html`
      <div class="card">
        <a class="post-link" href=${r.postUrl} target="_blank">${r.postUrl}</a>

        ${r.targetUrl ? html`
          <a class="post-link target-comment" href=${r.targetUrl} target="_blank">回覆此留言</a>
        ` : ''}

        <div class="reason">${r.relevanceReason}</div>

        <div class="reply-section">
          <div class="reply-label">建議回覆</div>
          <div class="reply-text">${r.suggestedReply}</div>
        </div>

        <div class="actions">
          ${this.copied
            ? html`<span class="copied">已複製</span>`
            : html`<button @click=${this.copyReply}>複製回覆</button>`}
          <button @click=${this.openPost}>前往貼文</button>
        </div>
      </div>
    `
  }
}
