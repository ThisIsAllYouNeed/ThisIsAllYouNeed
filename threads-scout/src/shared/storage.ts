import type { UserSettings } from './types'
import { DEFAULT_SETTINGS, EMBEDDING_MODEL } from './constants'

const SETTINGS_KEY = 'threads_scout_settings'
const PRODUCT_EMBEDDING_KEY = 'threads_scout_product_embedding'

/** 讀取使用者設定 */
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] }
}

/** 儲存使用者設定 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getSettings()
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...current, ...settings },
  })
}

interface CachedEmbedding {
  model: string
  embedding: number[]
}

function isCachedEmbedding(value: unknown): value is CachedEmbedding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return typeof obj.model === 'string' && Array.isArray(obj.embedding)
}

/** 讀取產品 embedding 快取（模型不符時自動失效） */
export async function getProductEmbedding(): Promise<number[] | null> {
  const result = await chrome.storage.local.get(PRODUCT_EMBEDDING_KEY)
  const cached = result[PRODUCT_EMBEDDING_KEY] as unknown
  if (!isCachedEmbedding(cached) || cached.model !== EMBEDDING_MODEL) return null
  return cached.embedding
}

/** 儲存產品 embedding 快取（含模型 ID 供版本驗證） */
export async function saveProductEmbedding(embedding: number[]): Promise<void> {
  const entry: CachedEmbedding = { model: EMBEDDING_MODEL, embedding }
  await chrome.storage.local.set({ [PRODUCT_EMBEDDING_KEY]: entry })
}

/** 清除產品 embedding 快取 */
export async function clearProductEmbedding(): Promise<void> {
  await chrome.storage.local.remove(PRODUCT_EMBEDDING_KEY)
}
