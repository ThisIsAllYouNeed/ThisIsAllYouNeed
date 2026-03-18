/** Threads 貼文資料結構 */
export interface ThreadPost {
  id: string
  url: string
  author: string
  authorHandle: string
  textContent: string
  timestamp: string
  likes: number
  replies: ThreadReply[]
}

/** 第一層留言 */
export interface ThreadReply {
  index: number
  author: string
  textContent: string
}

/** LLM 推薦結果 */
export interface Recommendation {
  postUrl: string
  targetComment: number
  relevanceReason: string
  suggestedReply: string
}

/** LLM 回傳格式 */
export interface LLMResponse {
  recommendations: Recommendation[]
}

/** 掃描狀態 */
export type ScanStatus = 'idle' | 'scanning' | 'paused' | 'analyzing' | 'done' | 'error'

/** 掃描進度 */
export interface ScanProgress {
  status: ScanStatus
  scanned: number
  filtered: number
  analyzed: number
  total: number
  error?: string
}

/** 使用者設定 */
export interface UserSettings {
  apiKey: string
  productName: string
  productDescription: string
  targetCount: number
  similarityThreshold: number
  llmModel: string
}

/** Embedding 結果 */
export interface EmbeddingResult {
  postId: string
  similarity: number
  passed: boolean
}
