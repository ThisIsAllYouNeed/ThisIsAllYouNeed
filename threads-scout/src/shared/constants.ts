import type { UserSettings } from './types'

/** 預設設定 */
export const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  productName: '',
  productDescription: '',
  targetCount: 50,
  enablePrefilter: true,
  similarityThreshold: 0.3,
  llmModel: 'openrouter/hunter-alpha',
}

/** Embedding 模型 ID */
export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small'

/** OpenRouter API 端點 */
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** 滾動設定 */
export const SCROLL_CONFIG = {
  /** 中文閱讀速度（字/分鐘） */
  readingSpeedMin: 300,
  readingSpeedMax: 500,
  /** 長暫停間隔（每 N 篇） */
  longPauseEveryMin: 3,
  longPauseEveryMax: 7,
  /** 長暫停時間（毫秒） */
  longPauseMin: 5000,
  longPauseMax: 15000,
  /** 留言展開 timeout（毫秒） */
  commentExpandTimeout: 5000,
}

/** LLM 批次大小 */
export const LLM_BATCH_SIZE = 5

/** 可選 LLM 模型 */
export const AVAILABLE_MODELS = [
  { id: 'openrouter/hunter-alpha', name: 'Hunter Alpha (免費)' },
  { id: 'openrouter/free', name: '免費模型路由 (隨機)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-haiku-3.5', name: 'Claude Haiku 3.5' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
]
