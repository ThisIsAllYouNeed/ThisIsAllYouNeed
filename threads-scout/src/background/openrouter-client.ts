import type { ThreadPost, Recommendation, UserSettings } from '../shared/types'
import { OPENROUTER_API_URL, OPENROUTER_TIMEOUT_MS } from '../shared/constants'

/** 呼叫 OpenRouter API 分析貼文並產生推薦 */
export async function analyzePosts(
  posts: ThreadPost[],
  settings: UserSettings,
): Promise<Recommendation[]> {
  const postsContext = posts.map((p, i) => {
    const replies = p.replies.map(r => `  [留言] @${r.authorHandle}: ${r.textContent}\n  連結: ${r.url}`).join('\n')
    return `--- 貼文 ${i + 1} ---
連結: ${p.url}
作者: ${p.author} (@${p.authorHandle})
內容: ${p.textContent}
按讚數: ${p.likes}
留言:
${replies || '  （無留言）'}`
  }).join('\n\n')

  const systemPrompt = `你是台灣社群行銷專家，幫助商家在 Threads 上找到自然推廣機會。
你的任務是分析貼文，找出適合回覆推廣的機會，並產生自然、不像廣告的中文回覆建議。

回覆原則：
1. 必須與貼文主題自然相關
2. 先回應原 PO 的觀點或問題，再自然帶入產品
3. 語氣親切自然，像一般使用者分享經驗
4. 避免直接推銷語氣
5. 回覆長度適中（50-150 字）

你必須回傳 JSON 格式，不要包含任何其他文字。`

  const userPrompt = `產品名稱: ${settings.productName}
產品描述: ${settings.productDescription}

以下是通過相關性過濾的貼文，請分析並產生回覆建議：

${postsContext}

請回傳以下 JSON 格式（只回傳 JSON，不要其他文字）：
{
  "recommendations": [
    {
      "postUrl": "貼文連結",
      "targetUrl": "",
      "relevanceReason": "此貼文為何與產品相關",
      "suggestedReply": "建議的回覆內容"
    }
  ]
}

注意：
- targetUrl 為空字串表示回覆原始貼文，填入留言連結表示回覆該留言
- 只推薦真正適合推廣的貼文，不相關的可以跳過
- relevanceReason 用繁體中文說明`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://thisisallyouneed.com',
        'X-Title': 'Threads Scout',
      },
      body: JSON.stringify({
        model: settings.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`OpenRouter API 回應逾時（${OPENROUTER_TIMEOUT_MS / 1000} 秒），請稍後再試或換一個模型`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API 錯誤 (${response.status}): ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('LLM 回傳內容為空')
  }

  try {
    const parsed = JSON.parse(content)
    return parsed.recommendations ?? []
  } catch {
    throw new Error('LLM 回傳格式錯誤，無法解析 JSON')
  }
}
