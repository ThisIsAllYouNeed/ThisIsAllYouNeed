/** Threads 貼文資料結構 */
export interface ThreadPost {
  id: string
  url: string
  author: string
  authorHandle: string
  textContent: string
  timestamp: string
  likes: number
  replies: ThreadPost[]
}

/** LLM 推薦結果 */
export interface Recommendation {
  postUrl: string
  targetUrl: string
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
  /** 目前每篇貼文的等待秒數 */
  currentWaitSec?: number
}

/** 使用者設定 */
export interface UserSettings {
  apiKey: string
  productName: string
  productDescription: string
  targetCount: number
  enablePrefilter: boolean
  similarityThreshold: number
  llmModel: string
}

/** Embedding 結果 */
export interface EmbeddingResult {
  postId: string
  similarity: number
  passed: boolean
}
