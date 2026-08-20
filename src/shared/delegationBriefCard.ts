/**
 * El encargo de una delegación entra al chat del especialista como mensaje de
 * usuario, y los mensajes de usuario se pintan literales a propósito (lo que
 * escribió una persona no se reinterpreta). Pero este no lo escribió nadie: lo
 * arma el host, y en crudo se leía como el objetivo pegado a un
 * `_(vía orquestador)_` cuyos guiones bajos nunca se vuelven cursiva, más la
 * línea `Preferred context ids:` que el despachador concatena en inglés.
 *
 * El bloque solo viaja en el texto que se PINTA (`displayUser`); el prompt que
 * recibe el CLI no lo lleva. El formato es paralelo al follow-up del resultado
 * (`delegationResultCards.ts`) por lo mismo que ese: es lo que la UI ya sabe
 * leer y no obliga a migrar los transcripts en disco.
 */

const BLOCK_HEADING = '## Delegation brief'

const META_KEYS = ['from', 'to', 'round', 'worktree', 'nested'] as const
type MetaKey = (typeof META_KEYS)[number]

/** La agrega el despachador al final del objetivo (`App.tsx`). */
const CONTEXT_HINT = /^Preferred context ids:\s*(.+)$/

export interface DelegationBriefCardData {
  /** Agente que delegó; sin él la tarjeta cae a la etiqueta genérica. */
  fromAgentId?: string
  toAgentId?: string
  /** Etiqueta cruda de la oleada, p. ej. `1/3` o `2/∞`. */
  round?: string
  /** Nombre del worktree aislado, no la ruta completa. */
  worktree?: string
  /** Especialista → especialista, no orquestador → especialista. */
  nested: boolean
  /** Contextos preferidos que pidió el orquestador. */
  contextIds: string[]
  /** El objetivo, ya sin la línea de contextos. */
  objective: string
}

export interface DelegationBriefInput {
  objective: string
  fromAgentId?: string
  toAgentId?: string
  round?: string
  /** Worktree aislado de la delegación; se muestra solo el último segmento. */
  cwd?: string
  nested?: boolean
}

function worktreeName(cwd: string): string {
  const parts = cwd.trim().replace(/[/\\]+$/, '').split(/[/\\]/)
  return parts[parts.length - 1] ?? ''
}

/** Texto de la burbuja: cabecera de metadatos + objetivo. */
export function buildDelegationBriefBlock(input: DelegationBriefInput): string {
  const meta: string[] = [BLOCK_HEADING]
  const from = input.fromAgentId?.trim()
  const to = input.toAgentId?.trim()
  const round = input.round?.trim()
  const worktree = input.cwd ? worktreeName(input.cwd) : ''
  if (from) meta.push(`from: ${from}`)
  if (to) meta.push(`to: ${to}`)
  if (round) meta.push(`round: ${round}`)
  if (worktree) meta.push(`worktree: ${worktree}`)
  if (input.nested) meta.push('nested: true')
  return `${meta.join('\n')}\n\n${input.objective}`
}

/**
 * Solo se quita la línea de contextos si es la última con texto: es donde la
 * pone el despachador, y así un objetivo que la menciona dentro de un bloque de
 * código se queda intacto.
 */
function splitContextHint(objective: string): { objective: string; contextIds: string[] } {
  const lines = objective.split('\n')
  let last = lines.length - 1
  while (last >= 0 && !lines[last].trim()) last--
  if (last < 0) return { objective: '', contextIds: [] }
  const match = CONTEXT_HINT.exec(lines[last].trim())
  if (!match) return { objective: objective.trim(), contextIds: [] }
  const contextIds = match[1].split(',').map(part => part.trim()).filter(Boolean)
  return { objective: lines.slice(0, last).join('\n').trim(), contextIds }
}

export function looksLikeDelegationBrief(content: string): boolean {
  return content.trimStart().startsWith(BLOCK_HEADING)
}

/** `null` cuando el mensaje no es un encargo: la UI cae a la burbuja normal. */
export function parseDelegationBrief(content: string): DelegationBriefCardData | null {
  if (!looksLikeDelegationBrief(content)) return null
  const lines = content.trimStart().split('\n')
  const meta: Partial<Record<MetaKey, string>> = {}
  let index = 1
  for (; index < lines.length; index++) {
    const key = META_KEYS.find(candidate => lines[index].startsWith(`${candidate}:`))
    if (!key) break
    if (meta[key] === undefined) meta[key] = lines[index].slice(key.length + 1).trim()
  }
  const { objective, contextIds } = splitContextHint(lines.slice(index).join('\n'))
  return {
    nested: meta.nested === 'true',
    contextIds,
    objective,
    ...(meta.from ? { fromAgentId: meta.from } : {}),
    ...(meta.to ? { toAgentId: meta.to } : {}),
    ...(meta.round ? { round: meta.round } : {}),
    ...(meta.worktree ? { worktree: meta.worktree } : {}),
  }
}
