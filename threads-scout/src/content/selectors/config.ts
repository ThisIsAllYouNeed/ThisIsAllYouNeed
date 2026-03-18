/**
 * 集中管理所有 DOM 選擇器
 * Threads 更新 UI 時只需修改此檔案
 */
export const SELECTORS = {
  /** 貼文容器 */
  postContainer: '[data-pressable-container]',

  /** 貼文作者名稱 */
  authorName: 'span[dir="auto"] > span',

  /** 貼文作者 handle（@xxx） */
  authorHandle: 'a[role="link"][href*="/@"]',

  /** 貼文內文 */
  postText: '[data-pressable-container] [dir="auto"]',

  /** 貼文時間戳 */
  timestamp: 'time[datetime]',

  /** 按讚數 */
  likeCount: '[role="button"][aria-label*="like"], [role="button"][aria-label*="讚"]',

  /** 展開留言按鈕 */
  expandRepliesButton: '[role="button"]',

  /** 展開留言的文字匹配 */
  expandRepliesText: ['查看回覆', 'replies', 'reply', '回覆'],

  /** 留言容器 */
  reply: '[data-pressable-container]',

  /** 留言作者 */
  replyAuthor: 'span[dir="auto"] > span',

  /** 留言文字 */
  replyText: '[dir="auto"]',

  /** 貼文連結（內嵌 JSON 中的 data-sjs script） */
  dataScript: 'script[type="application/json"][data-sjs]',

  /** 貼文 permalink 模式 */
  permalinkPattern: /\/@[\w.]+\/post\/[\w]+/,
} as const
