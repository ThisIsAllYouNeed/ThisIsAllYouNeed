import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers'
import { EMBEDDING_MODEL, EMBEDDING_POOLING } from '../shared/constants'

// MV3 CSP 禁止 blob URL worker，停用多執行緒以避免 importScripts 錯誤
env.backends.onnx.wasm.numThreads = 1

let extractor: FeatureExtractionPipeline | null = null

/** 產品 embedding 快取（在 offscreen document 生命週期內） */
let productEmbedding: number[] | null = null

/** 載入 embedding 模型 */
async function loadModel(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor

  extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
    quantized: true,
    progress_callback: (progress: { progress: number }) => {
      chrome.runtime.sendMessage({
        type: 'MODEL_LOADING',
        progress: progress.progress ?? 0,
      })
    },
  })

  chrome.runtime.sendMessage({ type: 'MODEL_READY' })
  return extractor
}

/** 計算文字 embedding（BGE-small-zh-v1.5 使用 CLS pooling，不需要前綴） */
async function computeEmbedding(text: string): Promise<number[]> {
  const model = await loadModel()
  const output = await model(text, {
    pooling: EMBEDDING_POOLING,
    normalize: true,
  })
  return Array.from(output.data as Float32Array)
}

/** 計算 cosine similarity */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// 監聽來自 Service Worker 的訊息，回傳時附帶 requestId
chrome.runtime.onMessage.addListener((msg: Record<string, unknown>, _sender, sendResponse) => {
  const requestId = msg.requestId as string | undefined

  if (msg.type === 'SET_PRODUCT_EMBEDDING') {
    productEmbedding = msg.embedding as number[]
    chrome.runtime.sendMessage({ type: 'PRODUCT_EMBEDDING_SET', requestId })
    sendResponse()
    return false
  }

  if (msg.type === 'COMPUTE_EMBEDDING') {
    computeEmbedding(msg.text as string)
      .then((embedding) => {
        chrome.runtime.sendMessage({
          type: 'EMBEDDING_READY',
          requestId,
          embedding,
        })
      })
      .catch((err) => {
        chrome.runtime.sendMessage({
          type: 'ERROR',
          requestId,
          error: err instanceof Error ? err.message : 'Embedding 計算失敗',
        })
      })
    sendResponse()
    return false
  }

  if (msg.type === 'COMPUTE_SIMILARITY') {
    if (!productEmbedding) {
      chrome.runtime.sendMessage({
        type: 'SIMILARITY_RESULT',
        requestId,
        result: { postId: msg.postId as string, similarity: 0 },
      })
      sendResponse()
      return false
    }

    computeEmbedding(msg.text as string)
      .then((postEmbedding) => {
        const similarity = cosineSimilarity(productEmbedding!, postEmbedding)
        chrome.runtime.sendMessage({
          type: 'SIMILARITY_RESULT',
          requestId,
          result: { postId: msg.postId as string, similarity },
        })
      })
      .catch((err) => {
        chrome.runtime.sendMessage({
          type: 'ERROR',
          requestId,
          error: err instanceof Error ? err.message : '相似度計算失敗',
        })
      })
    sendResponse()
    return false
  }

  sendResponse()
  return false
})
