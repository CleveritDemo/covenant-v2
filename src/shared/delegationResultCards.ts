import type { DelegateResultStatus } from './agentOrchestration'

/**
 * Lectura de presentación de `formatDelegationResultFollowUp` /
 * `buildBatchedDelegationFollowUp`. El texto que se manda al CLI no cambia:
 * esto solo parte el follow-up en tarjetas para la UI y descarta el boilerplate
 * del host (stop condition, topes de oleada, espera del batch, jobs turbo),
 * que es instrucción para el modelo y ruido para quien mira el chat.
 */

const BLOCK_HEADING = '## Delegation result'

/** Claves que el formatter emite después del summary (lo cierran). */
const TAIL_KEYS = [
  'toAgentId',
  'resultContextId',
  'orchestrationJobId',
  'orchestrationRound',
  'pendingInBatch',
] as const

type TailKey = (typeof TAIL_KEYS)[number]

export interface DelegationResultCardData {
  /** id de la delegación (línea `id:`). */
  id: string
  status: DelegateResultStatus
  /** agentId destino, si el follow-up lo trae. */
  agentId?: string
  /** Resumen del especialista sin las líneas de changelog. */
  summary: string
  /** Líneas de cambio (rutas/archivos) detectadas en el resumen. */
  changelog: string[]
  resultContextId?: string
  /** Etiqueta cruda de la oleada, p. ej. `1/3` o `2/∞`. */
  round?: string
  /** Especialistas que aún faltan en la oleada, si el host lo indicó. */
  pendingInBatch?: number
}

/** Instrucciones del host al modelo: nunca se muestran en la tarjeta. */
function isHostBoilerplateLine(line: string): boolean {
  const text = line.trim()
  if (!text) return false
  return (
    text.startsWith('Stop condition:') ||
    text.startsWith('Do NOT emit') ||
    text.startsWith('Wait for the remaining specialist results') ||
    text.startsWith('If the slice PASSED') ||
    text.startsWith('There is no host wave cap') ||
    /^At most \d+ delegation waves/.test(text) ||
    text.startsWith('## Concurrent jobs') ||
    text.startsWith('These results belong to') ||
    text.startsWith('Other jobs/waves may still be in flight') ||
    text.startsWith('Integrate only this batch')
  )
}

function matchTailKey(line: string): { key: TailKey; value: string } | null {
  for (const key of TAIL_KEYS) {
    const prefix = `${key}:`
    if (line.startsWith(prefix)) {
      return { key, value: line.slice(prefix.length).trim() }
    }
  }
  return null
}

function toStatus(raw: string): DelegateResultStatus {
  if (raw === 'fail') return 'fail'
  if (raw === 'aborted') return 'aborted'
  return 'ok'
}

/** Encabezado de la sección de cambios que suelen escribir los especialistas. */
function isChangelogHeading(line: string): boolean {
  const match = /^#{1,6}\s+(.*)$/.exec(line.trim())
  if (!match) return false
  const title = match[1].trim().toLowerCase().replace(/[:.]+$/, '')
  return (
    title === 'what changed' ||
    title === 'changes' ||
    title === 'changelog' ||
    title === 'qué cambió' ||
    title === 'que cambió' ||
    title === 'cambios'
  )
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-*•]\s+/, '').trim()
}

function isBullet(line: string): boolean {
  return /^[-*•]\s+/.test(line.trim())
}

/** Ruta o archivo: `src/a/b.ts`, `AgentPane.css`, `docs/README`. */
function looksLikePath(text: string): boolean {
  return /(^|[\s(`])[\w.@-]+\/[\w./@-]+/.test(text) ||
    /(^|[\s(`])[\w.-]+\.[A-Za-z0-9]{1,8}(\b|$)/.test(text)
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && !lines[start].trim()) start++
  while (end > start && !lines[end - 1].trim()) end--
  return lines.slice(start, end)
}

/**
 * Parte el resumen en texto + changelog. Con encabezado explícito manda el
 * encabezado; si no, se extraen los bullets que apuntan a archivos.
 */
function splitSummary(rawLines: string[]): { summary: string; changelog: string[] } {
  const lines = trimBlankEdges(rawLines)
  const headingIndex = lines.findIndex(isChangelogHeading)
  if (headingIndex >= 0) {
    const summary = trimBlankEdges(lines.slice(0, headingIndex)).join('\n').trim()
    const changelog = lines
      .slice(headingIndex + 1)
      .map(stripBullet)
      .filter(Boolean)
    return { summary, changelog }
  }
  const summaryLines: string[] = []
  const changelog: string[] = []
  for (const line of lines) {
    if (isBullet(line) && looksLikePath(line)) {
      changelog.push(stripBullet(line))
      continue
    }
    summaryLines.push(line)
  }
  return { summary: trimBlankEdges(summaryLines).join('\n').trim(), changelog }
}

function parseBlock(lines: string[]): DelegationResultCardData | null {
  let id = ''
  let status: DelegateResultStatus | null = null
  let inSummary = false
  let summaryClosed = false
  const summaryLines: string[] = []
  const tail: Partial<Record<TailKey, string>> = {}

  for (const line of lines) {
    if (isHostBoilerplateLine(line)) break
    if (!inSummary || summaryClosed) {
      const tailMatch = matchTailKey(line)
      if (tailMatch) {
        summaryClosed = inSummary
        if (tail[tailMatch.key] === undefined) tail[tailMatch.key] = tailMatch.value
        continue
      }
      if (!id && line.startsWith('id:')) {
        id = line.slice('id:'.length).trim()
        continue
      }
      if (status === null && line.startsWith('status:')) {
        status = toStatus(line.slice('status:'.length).trim())
        continue
      }
      if (!inSummary && line.startsWith('summary:')) {
        inSummary = true
        summaryLines.push(line.slice('summary:'.length).trim())
        continue
      }
      continue
    }
    const tailMatch = matchTailKey(line)
    if (tailMatch) {
      summaryClosed = true
      if (tail[tailMatch.key] === undefined) tail[tailMatch.key] = tailMatch.value
      continue
    }
    summaryLines.push(line)
  }

  if (!id && status === null && !inSummary) return null

  const { summary, changelog } = splitSummary(summaryLines)
  const pendingRaw = tail.pendingInBatch ? Number.parseInt(tail.pendingInBatch, 10) : Number.NaN
  return {
    id,
    status: status ?? 'ok',
    summary,
    changelog,
    ...(tail.toAgentId ? { agentId: tail.toAgentId } : {}),
    ...(tail.resultContextId ? { resultContextId: tail.resultContextId } : {}),
    ...(tail.orchestrationRound ? { round: tail.orchestrationRound } : {}),
    ...(Number.isFinite(pendingRaw) && pendingRaw > 0 ? { pendingInBatch: pendingRaw } : {}),
  }
}

/** ¿El contenido de un mensaje viejo (sin `presentation`) es un follow-up? */
export function looksLikeDelegationResultFollowUp(content: string): boolean {
  return content.trimStart().startsWith(BLOCK_HEADING)
}

/**
 * Una tarjeta por bloque `## Delegation result`. Vacío si el texto no es un
 * follow-up de delegación (p. ej. `## Orchestration limit`), y entonces la UI
 * cae a la burbuja normal.
 */
export function parseDelegationResultCards(content: string): DelegationResultCardData[] {
  if (!content.includes(BLOCK_HEADING)) return []
  const lines = content.split('\n')
  const starts: number[] = []
  lines.forEach((line, index) => {
    if (line.trim() === BLOCK_HEADING) starts.push(index)
  })
  if (!starts.length) return []
  const cards: DelegationResultCardData[] = []
  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length
    const card = parseBlock(lines.slice(start + 1, end))
    if (card) cards.push(card)
  })
  return cards
}
