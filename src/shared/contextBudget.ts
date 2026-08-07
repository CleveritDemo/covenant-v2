import type { TabContextKind } from './tabContext'
import { CUSTOM_CONTEXT_KINDS } from './tabContext'
import type { ContextSectionDescriptor } from './contextSections'
import { MAX_REQUESTED_CONTEXT_CHARS } from './contextSections'

/** Cómo llega el contexto al prompt: catálogo de claves, o cuerpo entero. */
export type ContextDelivery = 'catalog' | 'whole'

export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface ContextBudgetSummary {
  sections: number
  chars: number
  /** Estimación cruda chars/4; la UI la rotula como estimación. */
  estimatedTokens: number
  delivery: ContextDelivery
  level: BudgetLevel
  /** chars / MAX_REQUESTED_CONTEXT_CHARS, saturado a 1. */
  ratio: number
}

const WARN_RATIO = 0.55
const OVER_RATIO = 0.85
/** Regla de dedo estándar; no vale la pena un tokenizer real para un medidor. */
const CHARS_PER_TOKEN = 4

/** Deriva de CUSTOM_CONTEXT_KINDS para no repetir la lista. */
export function deliveryModeFor(kind: TabContextKind): ContextDelivery {
  return (CUSTOM_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)
    ? 'whole'
    : 'catalog'
}

export function summarizeContextBudget(
  sections: readonly ContextSectionDescriptor[],
  kind: TabContextKind,
): ContextBudgetSummary {
  const chars = sections.reduce((total, section) => total + section.chars, 0)
  const rawRatio = chars / MAX_REQUESTED_CONTEXT_CHARS
  return {
    sections: sections.length,
    chars,
    estimatedTokens: Math.ceil(chars / CHARS_PER_TOKEN),
    delivery: deliveryModeFor(kind),
    level: rawRatio >= OVER_RATIO ? 'over' : rawRatio >= WARN_RATIO ? 'warn' : 'ok',
    ratio: Math.min(1, rawRatio),
  }
}
