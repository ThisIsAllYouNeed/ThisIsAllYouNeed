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
      background: var(--c-bg, #ffffff);
      border: 1px solid var(--c-border, #e2e8f0);
      border-left: 3px solid var(--c-primary, #6366f1);
      border-radius: var(--radius-sm, 6px);
      padding: 14px;
      transition: box-shadow 0.2s;
    }

    .card:hover {
      box-shadow: var(--shadow-md);
    }

    .post-link {
      font-size: 12px;
      color: var(--c-primary, #6366f1);
      text-decoration: none;
      word-break: break-all;
      font-weight: 500;
    }

    .post-link:hover {
      text-decoration: underline;
    }

    .target-link {
      display: inline-block;
      font-size: 11px;
      color: var(--c-text-tertiary, #94a3b8);
      text-decoration: none;
      margin-top: 4px;
    }

    .target-link:hover {
      color: var(--c-primary, #6366f1);
      text-decoration: underline;
    }

    .reason {
      font-size: 13px;
      color: var(--c-text-secondary, #64748b);
      margin: 10px 0;
      line-height: 1.6;
    }

    .reply-section {
      background: var(--c-surface, #f8fafc);
      border-radius: var(--radius-sm, 6px);
      padding: 12px;
      margin-top: 10px;
    }

    .reply-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--c-text-tertiary, #94a3b8);
      margin-bottom: 6px;
    }

    .reply-text {
      font-size: 13px;
      color: var(--c-text, #0f172a);
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .action-btn {
      padding: 6px 14px;
      border: 1px solid var(--c-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      background: var(--c-bg, #ffffff);
      font-size: 12px;
      font-weight: 500;
      color: var(--c-text-secondary, #64748b);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .action-btn:hover {
      border-color: var(--c-primary, #6366f1);
      color: var(--c-primary, #6366f1);
      background: var(--c-primary-soft, rgba(99, 102, 241, 0.08));
    }

    .action-btn:active {
      transform: scale(0.97);
    }

    .copied {
      color: var(--c-success, #10b981);
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
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
          <a class="target-link" href=${r.targetUrl} target="_blank">↳ 回覆此留言</a>
        ` : ''}

        <div class="reason">${r.relevanceReason}</div>

        <div class="reply-section">
          <div class="reply-label">建議回覆</div>
          <div class="reply-text">${r.suggestedReply}</div>
        </div>

        <div class="actions">
          ${this.copied
            ? html`<span class="copied">✓ 已複製</span>`
            : html`<button class="action-btn" @click=${this.copyReply}>複製回覆</button>`}
          <button class="action-btn" @click=${this.openPost}>前往貼文</button>
        </div>
      </div>
    `
  }
}
