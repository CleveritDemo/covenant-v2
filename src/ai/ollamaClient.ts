export type { ChatMessage } from './types'
import type { ChatMessage } from './types'

export interface OllamaOptions {
  baseURL: string
  model: string
  onToken?: (text: string) => void
  /** Recibe los tokens de razonamiento interno (solo cuando think: true y el modelo los emite). */
  onThinkingToken?: (text: string) => void
  signal?: AbortSignal
  /** Activa thinking en modelos compatibles (qwen3, deepseek-r1, etc.). */
  think?: boolean
}

export async function chatOllama(
  messages: ChatMessage[],
  options: OllamaOptions
): Promise<string> {
  const base = options.baseURL.replace(/\/$/, '')
  const url = `${base}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      messages,
      stream: true,
      ...(options.think ? { think: true } : {}),
    }),
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text}`)
  }

  if (!res.body) throw new Error('No body in Ollama response')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  /** Acumula chunks hasta líneas NDJSON completas (evita perder tokens al partir JSON entre lecturas). */
  let lineBuffer = ''

  /**
   * Algunos modelos (qwen3, deepseek-r1 en ciertas versiones de Ollama) no usan
   * `message.thinking` sino que emiten los tokens de razonamiento dentro de
   * `message.content` envueltos en `<think>…</think>`. Este flag rastrea si
   * estamos dentro de ese bloque para rutear los tokens correctamente.
   */
  let insideThinkTag = false
  /**
   * Buffer parcial para detectar los marcadores `<think>` y `</think>` que
   * pueden llegar partidos entre varios tokens del stream.
   */
  let thinkTagBuf = ''

  function routeToken(token: string): void {
    let remaining = thinkTagBuf + token
    thinkTagBuf = ''

    while (remaining.length > 0) {
      if (insideThinkTag) {
        const closeIdx = remaining.indexOf('</think>')
        if (closeIdx === -1) {
          // Puede que el cierre llegue partido; guardamos el sufijo sospechoso
          const suspectLen = '</think>'.length - 1
          const safe = remaining.slice(0, Math.max(0, remaining.length - suspectLen))
          const suspect = remaining.slice(safe.length)
          if (safe) options.onThinkingToken?.(safe)
          thinkTagBuf = suspect
          return
        }
        const thinkContent = remaining.slice(0, closeIdx)
        if (thinkContent) options.onThinkingToken?.(thinkContent)
        insideThinkTag = false
        remaining = remaining.slice(closeIdx + '</think>'.length)
      } else {
        const openIdx = remaining.indexOf('<think>')
        if (openIdx === -1) {
          const suspectLen = '<think>'.length - 1
          const safe = remaining.slice(0, Math.max(0, remaining.length - suspectLen))
          const suspect = remaining.slice(safe.length)
          if (safe) { full += safe; options.onToken?.(safe) }
          thinkTagBuf = suspect
          return
        }
        const before = remaining.slice(0, openIdx)
        if (before) { full += before; options.onToken?.(before) }
        insideThinkTag = true
        remaining = remaining.slice(openIdx + '<think>'.length)
      }
    }
  }

  function consumeJsonLine(line: string): void {
    const t = line.trim()
    if (!t) return
    try {
      const json = JSON.parse(t) as { message?: { content?: string; thinking?: string } }
      // Thinking nativo de Ollama (modelos con soporte formal de think)
      const thinkToken: string = json?.message?.thinking ?? ''
      if (thinkToken) {
        options.onThinkingToken?.(thinkToken)
      }
      const token: string = json?.message?.content ?? ''
      if (token) {
        if (options.onThinkingToken) {
          // Filtrar posibles <think>…</think> embebidos en el contenido
          routeToken(token)
        } else {
          full += token
          options.onToken?.(token)
        }
      }
    } catch {
      // línea corrupta o JSON aún incompleto (no debería ocurrir tras partición correcta)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      lineBuffer += decoder.decode(value, { stream: !done })
    }
    if (done) {
      lineBuffer += decoder.decode()
      break
    }
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      consumeJsonLine(line)
    }
  }

  const tailLines = lineBuffer.split('\n')
  for (const line of tailLines) {
    consumeJsonLine(line)
  }

  // Vaciar lo que quedó pendiente en el buffer de detección de <think>
  if (thinkTagBuf) {
    if (insideThinkTag) {
      options.onThinkingToken?.(thinkTagBuf)
    } else {
      full += thinkTagBuf
      options.onToken?.(thinkTagBuf)
    }
  }

  return full
}
