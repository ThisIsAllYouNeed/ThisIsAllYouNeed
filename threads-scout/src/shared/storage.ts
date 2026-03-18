import type { UserSettings } from './types'
import { DEFAULT_SETTINGS } from './constants'

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

/** 讀取產品 embedding 快取 */
export async function getProductEmbedding(): Promise<number[] | null> {
  const result = await chrome.storage.local.get(PRODUCT_EMBEDDING_KEY)
  return result[PRODUCT_EMBEDDING_KEY] ?? null
}

/** 儲存產品 embedding 快取 */
export async function saveProductEmbedding(embedding: number[]): Promise<void> {
  await chrome.storage.local.set({ [PRODUCT_EMBEDDING_KEY]: embedding })
}

/** 清除產品 embedding 快取 */
export async function clearProductEmbedding(): Promise<void> {
  await chrome.storage.local.remove(PRODUCT_EMBEDDING_KEY)
}
