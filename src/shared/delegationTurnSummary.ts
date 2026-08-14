/**
 * Resumen de cierre de delegación: assistant visible vs. bloque ia-terminal-results.
 * Usado al notificar al orquestador cuando el especialista solo emite results fence.
 */

const PLACEHOLDER_RE = /^\((empty response|sin respuesta|empty)\)$/i

export function isDelegationSummaryPlaceholder(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  return PLACEHOLDER_RE.test(trimmed)
}

export function buildDelegationTurnSummary(input: {
  assistantText?: string
  resultsSummary?: string | null
  resultsChanges?: readonly string[]
  emptyFallback: string
}): string {
  const assistant = (input.assistantText ?? '').trim()
  if (assistant && !isDelegationSummaryPlaceholder(assistant)) {
    return assistant.slice(0, 500)
  }
  const fromResults = (input.resultsSummary ?? '').trim()
  if (fromResults && !isDelegationSummaryPlaceholder(fromResults)) {
    return fromResults.slice(0, 500)
  }
  const changes = (input.resultsChanges ?? []).map(item => item.trim()).filter(Boolean)
  if (changes.length > 0) {
    return changes.slice(0, 3).join('; ').slice(0, 500)
  }
  return input.emptyFallback
}

/** True si el nuevo resumen reemplaza un placeholder ya persistido (anti-race turbo). */
export function isBetterDelegationSummary(current: string, next: string): boolean {
  return isDelegationSummaryPlaceholder(current) && !isDelegationSummaryPlaceholder(next)
}
