import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import { EMBEDDING_MODEL } from '../shared/constants'
import type { ExtensionMessage } from '../shared/messages'

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
  // multilingual-e5-small 建議加 "query: " 前綴
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

// 監聽來自 Service Worker 的訊息
chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  if (msg.type === 'COMPUTE_EMBEDDING') {
    computeEmbedding(msg.text).then((embedding) => {
      if (!msg.postId) {
        // 這是產品 embedding
        productEmbedding = embedding
      }
      chrome.runtime.sendMessage({
        type: 'EMBEDDING_READY',
        postId: msg.postId,
        embedding,
      })
    })
    sendResponse()
    return false
  }

  if (msg.type === 'COMPUTE_SIMILARITY') {
    computeEmbedding(msg.text).then((postEmbedding) => {
      const similarity = productEmbedding
        ? cosineSimilarity(productEmbedding, postEmbedding)
        : 0

      chrome.runtime.sendMessage({
        type: 'SIMILARITY_RESULT',
        result: {
          postId: msg.postId,
          similarity,
          passed: similarity >= 0.3, // 閾值由 service worker 控制，這裡只回傳分數
        },
      })
    })
    sendResponse()
    return false
  }

  sendResponse()
  return false
})
