import type { ChatMessage } from './types'
import { readSSEStream } from './sseStream'

export interface OpenAIOptions {
  apiKey: string
  model: string
  onToken?: (text: string) => void
  /** Para o3/o4-mini: tokens de razonamiento internos. */
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
}

interface OpenAIDelta {
  content?: string
  reasoning_content?: string
}

interface OpenAIChunk {
  choices?: Array<{ delta?: OpenAIDelta }>
}

export async function chatOpenAI(
  messages: ChatMessage[],
  options: OpenAIOptions,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ model: options.model, messages, stream: true }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.body) throw new Error('No body in OpenAI response')

  let full = ''

  await readSSEStream(res.body, data => {
    if (data === '[DONE]') return
    try {
      const chunk = JSON.parse(data) as OpenAIChunk
      const delta = chunk.choices?.[0]?.delta
      if (delta?.reasoning_content) {
        options.onThinkingToken?.(delta.reasoning_content)
      }
      if (delta?.content) {
        full += delta.content
        options.onToken?.(delta.content)
      }
    } catch { /* JSON incompleto */ }
  })

  return full
}
