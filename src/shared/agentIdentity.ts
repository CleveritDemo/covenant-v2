/** Identidad persistida del agente; se inyecta en cada turno del CLI. */
export interface AgentIdentity {
  name?: string
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

/** Reglas no vacías, recortadas y acotadas al máximo permitido. */
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
