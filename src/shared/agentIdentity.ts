/** Identidad persistida del agente; se inyecta en cada turno del CLI. */
export interface AgentIdentity {
  name?: string
  role?: string
  objective?: string
}

export const AGENT_NAME_MAX_LENGTH = 48
export const AGENT_ROLE_MAX_LENGTH = 80
export const AGENT_OBJECTIVE_MAX_LENGTH = 500

/** Bloque Markdown con nombre, rol y objetivo (vacío si no hay nada). */
export function buildAgentIdentityPrompt(identity: AgentIdentity): string {
  const name = identity.name?.trim()
  const role = identity.role?.trim()
  const objective = identity.objective?.trim()
  if (!name && !role && !objective) return ''

  const lines = [
    '## Agent identity',
    'You are this agent. Follow this identity in every reply and action.',
  ]
  if (name) lines.push(`- Name: ${name}`)
  if (role) lines.push(`- Role: ${role}`)
  if (objective) lines.push(`- Objective: ${objective}`)
  return lines.join('\n')
}
