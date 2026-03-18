import type { UserSettings } from './types'

/** 預設設定 */
export const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  productName: '',
  productDescription: '',
  targetCount: 50,
  enablePrefilter: true,
  similarityThreshold: 0.7,
  llmModel: 'openrouter/hunter-alpha',
}

/** Embedding 模型設定（BGE-small-zh-v1.5：24MB、MIT 授權、中文專用、分數分佈 [0.4-1.0]） */
export const EMBEDDING_MODEL = 'Xenova/bge-small-zh-v1.5'
export const EMBEDDING_POOLING = 'cls' as const

/** OpenRouter API 端點 */
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** 滾動設定 */
export const SCROLL_CONFIG = {
  /** 長暫停間隔（每 N 篇） */
  longPauseEveryMin: 3,
  longPauseEveryMax: 7,
  /** 長暫停時間（毫秒） */
  longPauseMin: 5000,
  longPauseMax: 15000,
  /** 留言展開 timeout（毫秒） */
  commentExpandTimeout: 5000,
  /** fetchReplies 總超時（毫秒），防止永遠卡住 */
  fetchRepliesTimeout: 20000,
  /** history.back() 後等待頁面導航（毫秒） */
  navigationWaitTimeout: 3000,
  /** 硬跳轉後等待頁面載入（毫秒） */
  hardNavigationWait: 3000,
  /** 等待留言容器載入（毫秒） */
  waitForRepliesTimeout: 3000,
  /** 詳情頁 DOM 穩定等待（毫秒），讓主貼文 thread 完整渲染 */
  detailPageSettleWait: 1000,
  /** 目標閱讀位置（視窗高度比例），0.15 表示從頂部往下 15% */
  scrollTargetRatio: 0.15,
  /** 貼文間距估計（像素） */
  postGapEstimate: 12,
  /** 最小滾動距離（像素） */
  minScrollDistance: 100,
  /** IntersectionObserver 觀測區域：裁掉視窗底部的百分比（%），只在頂部區域偵測貼文 */
  observerBottomCropPercent: 55,
  /** IntersectionObserver 門檻：貼文在觀測區域中需可見的比例 */
  observerThreshold: 0.3,
}

/** 興趣驅動行為設定檔 */
export const INTEREST_PROFILES = {
  high: {
    tickPauseMin: 600,
    tickPauseMax: 1500,
    tickSizeMin: 0.04,
    tickSizeMax: 0.08,
    downwardProb: 0.75,
    enterRepliesProb: 0.6,
    markForRevisit: true,
  },
  low: {
    tickPauseMin: 150,
    tickPauseMax: 400,
    tickSizeMin: 0.06,
    tickSizeMax: 0.12,
    downwardProb: 0.95,
    enterRepliesProb: 0,
    markForRevisit: false,
  },
} as const

export type InterestProfile = typeof INTEREST_PROFILES[keyof typeof INTEREST_PROFILES]

/** 詳情頁瀏覽行為（模擬閱讀留言） */
export const DETAIL_BROWSE_CONFIG = {
  /** 瀏覽的 tick 次數範圍 */
  tickCountMin: 2,
  tickCountMax: 5,
  /** 每 tick 停留時間（毫秒） */
  tickPauseMin: 800,
  tickPauseMax: 2000,
  /** 每 tick 捲動量（視窗百分比） */
  tickSizeMin: 0.08,
  tickSizeMax: 0.2,
  /** tick 往下的機率（其餘為小回捲） */
  downwardProb: 0.8,
  /** 回捲時的距離倍數 */
  backscrollRatio: 0.3,
  /** 離開前最後停留時間（毫秒） */
  finalPauseMin: 500,
  finalPauseMax: 1500,
} as const

export const REVISIT_CONFIG = {
  postsBeforeRevisitMin: 2,
  postsBeforeRevisitMax: 5,
  revisitPauseMin: 3000,
  revisitPauseMax: 5000,
  revisitProb: 0.7,
  maxQueueSize: 10,
} as const

/** OpenRouter API 回應超時（毫秒） */
export const OPENROUTER_TIMEOUT_MS = 120000

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
