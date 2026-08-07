/** Identidad persistida del agente; se inyecta en cada turno del CLI. */
export interface AgentIdentity {
  name?: string
  /** Cara visual, no va al prompt: 2 caracteres derivados del name si falta. */
  monogram?: string
  role?: string
  objective?: string
  /** Reglas de comportamiento; se envían en cada turno (no cada 10 como los contextos). */
  rules?: string[]
}

export const AGENT_NAME_MAX_LENGTH = 48
export const AGENT_ROLE_MAX_LENGTH = 80
export const AGENT_OBJECTIVE_MAX_LENGTH = 500
export const AGENT_RULE_MAX_LENGTH = 280
export const AGENT_RULES_MAX_COUNT = 20
export const AGENT_MONOGRAM_MAX_LENGTH = 2

/**
 * Monograma de 2 caracteres para la cara del agente. Solo letras/dígitos:
 * se dibuja en 9.5px mono y un emoji o signo rompe la métrica.
 */
export function sanitizeAgentMonogram(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const glyphs = Array.from(value.replace(/[^\p{L}\p{N}]+/gu, ''))
    .slice(0, AGENT_MONOGRAM_MAX_LENGTH)
    .join('')
    .toUpperCase()
  return glyphs || undefined
}

/**
 * Borrador de texto en UI/catálogo: conserva espacios (p. ej. al escribir
 * "hola mundo"); omite solo si queda vacío tras trim. El trim real va al prompt.
 */
export function sanitizeAgentTextDraft(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const next = value.slice(0, maxLength)
  return next.trim() ? next : undefined
}

/**
 * Slots de edición en UI/catálogo: mantiene vacíos (borrador),
 * solo recorta longitud y cantidad.
 */
export function sanitizeAgentRulesDraft(rules: string[] | undefined): string[] {
  if (!Array.isArray(rules)) return []
  return rules
    .slice(0, AGENT_RULES_MAX_COUNT)
    .map(raw => String(raw ?? '').slice(0, AGENT_RULE_MAX_LENGTH))
}

/** Borrador de identidad en el modal de config (valores crudos de inputs). */
export interface AgentIdentityDraft {
  /** Slug del JSON en `.gravity/agents/<id>.json`. */
  id: string
  name: string
  monogram: string
  role: string
  objective: string
  rules: string[]
}

/** Aplica el borrador a la meta: trim/clamp una sola vez (blur o cierre). No toca `id`. */
export function applyAgentIdentityDraft<T extends AgentIdentity>(
  previous: T,
  draft: AgentIdentityDraft,
): T {
  const name = sanitizeAgentTextDraft(draft.name.trim(), AGENT_NAME_MAX_LENGTH)
  const monogram = sanitizeAgentMonogram(draft.monogram)
  const role = sanitizeAgentTextDraft(draft.role.trim(), AGENT_ROLE_MAX_LENGTH)
  const objective = sanitizeAgentTextDraft(draft.objective.trim(), AGENT_OBJECTIVE_MAX_LENGTH)
  const rules = normalizeAgentRules(draft.rules)

  const {
    name: _name,
    monogram: _monogram,
    role: _role,
    objective: _objective,
    rules: _rules,
    ...rest
  } = previous

  return {
    ...rest,
    ...(name ? { name } : {}),
    ...(monogram ? { monogram } : {}),
    ...(role ? { role } : {}),
    ...(objective ? { objective } : {}),
    ...(rules.length ? { rules } : {}),
  } as T
}

/** Reglas no vacías, recortadas y acotadas (prompt / turno CLI). */
export function normalizeAgentRules(rules: string[] | undefined): string[] {
  if (!Array.isArray(rules)) return []
  const out: string[] = []
  for (const raw of rules) {
    const text = String(raw ?? '').trim().slice(0, AGENT_RULE_MAX_LENGTH)
    if (!text) continue
    out.push(text)
    if (out.length >= AGENT_RULES_MAX_COUNT) break
  }
  return out
}

/** Bloque Markdown con nombre, rol, objetivo y reglas (vacío si no hay nada). */
export function buildAgentIdentityPrompt(identity: AgentIdentity): string {
  const name = identity.name?.trim()
  const role = identity.role?.trim()
  const objective = identity.objective?.trim()
  const rules = normalizeAgentRules(identity.rules)
  if (!name && !role && !objective && rules.length === 0) return ''

  const lines = [
    '## Agent identity',
    'You are this agent. Follow this identity in every reply and action.',
  ]
  if (name) lines.push(`- Name: ${name}`)
  if (role) lines.push(`- Role: ${role}`)
  if (objective) lines.push(`- Objective: ${objective}`)
  if (rules.length > 0) {
    lines.push('- Rules:')
    for (const [index, rule] of rules.entries()) {
      lines.push(`  ${index + 1}. ${rule}`)
    }
  }
  return lines.join('\n')
}
