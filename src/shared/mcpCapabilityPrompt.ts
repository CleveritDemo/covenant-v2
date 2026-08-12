/**
 * Preámbulo de capacidades MCP para el prompt del turno.
 *
 * Solo cuando el agente tiene allowlist explícita (`mcpsAllowed`): es el caso
 * «Solo estas» del PO, donde sí sabemos qué servidores debe usar.
 */

export function buildMcpCapabilityPrompt(mcpsAllowed: readonly string[]): string {
  const names = mcpsAllowed.map(name => name.trim()).filter(Boolean)
  if (!names.length) return ''

  const list = names.map(name => `- \`${name}\``).join('\n')
  return [
    '## MCP tools available',
    'This agent is launched with these MCP servers enabled:',
    list,
    'Use their tools via your CLI tool interface for Jira, Atlassian, tickets, and related lookups.',
    'Do not claim you lack integrated Jira/Atlassian access.',
    'Do not invent tools that are not in your tool list (for example `web_fetch`).',
    'If a tool call fails, report the tool error — do not pretend the MCP is missing.',
  ].join('\n')
}
