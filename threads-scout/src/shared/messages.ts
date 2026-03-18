import type { ThreadPost, ScanProgress, Recommendation, EmbeddingResult } from './types'

// === Content Script → Service Worker ===

export interface PostScrapedMessage {
  type: 'POST_SCRAPED'
  post: ThreadPost
}

export interface ScanCompleteMessage {
  type: 'SCAN_COMPLETE'
  totalScraped: number
}

// === Service Worker → Content Script ===

export interface StartScanMessage {
  type: 'START_SCAN'
  targetCount: number
}

export interface PauseScanMessage {
  type: 'PAUSE_SCAN'
}

export interface StopScanMessage {
  type: 'STOP_SCAN'
}

export interface ResumeScanMessage {
  type: 'RESUME_SCAN'
}

// === Service Worker → Offscreen Document ===

export interface ComputeEmbeddingMessage {
  type: 'COMPUTE_EMBEDDING'
  text: string
  postId?: string
}

export interface EmbeddingReadyMessage {
  type: 'EMBEDDING_READY'
  postId?: string
  embedding: number[]
}

export interface ComputeSimilarityMessage {
  type: 'COMPUTE_SIMILARITY'
  postId: string
  text: string
}

export interface SimilarityResultMessage {
  type: 'SIMILARITY_RESULT'
  result: EmbeddingResult
}

export interface ModelLoadingMessage {
  type: 'MODEL_LOADING'
  progress: number
}

export interface ModelReadyMessage {
  type: 'MODEL_READY'
}

// === Service Worker → Side Panel ===

export interface ProgressUpdateMessage {
  type: 'PROGRESS_UPDATE'
  progress: ScanProgress
}

export interface RecommendationMessage {
  type: 'RECOMMENDATION'
  recommendations: Recommendation[]
}

export interface ErrorMessage {
  type: 'ERROR'
  error: string
}

// === Side Panel → Service Worker ===

export interface RequestStartMessage {
  type: 'REQUEST_START'
}

export interface RequestPauseMessage {
  type: 'REQUEST_PAUSE'
}

export interface RequestResumeMessage {
  type: 'REQUEST_RESUME'
}

export interface RequestStopMessage {
  type: 'REQUEST_STOP'
}

/** 所有訊息型別的聯合型別 */
export type ExtensionMessage =
  | PostScrapedMessage
  | ScanCompleteMessage
  | StartScanMessage
  | PauseScanMessage
  | StopScanMessage
  | ResumeScanMessage
  | ComputeEmbeddingMessage
  | EmbeddingReadyMessage
  | ComputeSimilarityMessage
  | SimilarityResultMessage
  | ModelLoadingMessage
  | ModelReadyMessage
  | ProgressUpdateMessage
  | RecommendationMessage
  | ErrorMessage
  | RequestStartMessage
  | RequestPauseMessage
  | RequestResumeMessage
  | RequestStopMessage
