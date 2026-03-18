import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import { EMBEDDING_MODEL } from '../shared/constants'

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

/** 計算文字 embedding */
async function computeEmbedding(text: string): Promise<number[]> {
  const model = await loadModel()
  const output = await model(`query: ${text}`, {
    pooling: 'mean',
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

  if (msg.type === 'COMPUTE_EMBEDDING') {
    computeEmbedding(msg.text as string).then((embedding) => {
      if (!requestId) {
        // 沒有 requestId 視為產品 embedding
        productEmbedding = embedding
      }
      chrome.runtime.sendMessage({
        type: 'EMBEDDING_READY',
        requestId,
        embedding,
      })
    })
    sendResponse()
    return false
  }

  if (msg.type === 'COMPUTE_SIMILARITY') {
    computeEmbedding(msg.text as string).then((postEmbedding) => {
      const similarity = productEmbedding
        ? cosineSimilarity(productEmbedding, postEmbedding)
        : 0

      chrome.runtime.sendMessage({
        type: 'SIMILARITY_RESULT',
        requestId,
        result: {
          postId: msg.postId as string,
          similarity,
          passed: similarity >= 0.3,
        },
      })
    })
    sendResponse()
    return false
  }

  sendResponse()
  return false
})
