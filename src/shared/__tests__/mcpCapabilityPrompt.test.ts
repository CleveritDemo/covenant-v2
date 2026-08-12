import { describe, expect, it } from 'vitest'
import { buildMcpCapabilityPrompt } from '../mcpCapabilityPrompt'

describe('buildMcpCapabilityPrompt', () => {
  it('vacío sin allowlist', () => {
    expect(buildMcpCapabilityPrompt([])).toBe('')
    expect(buildMcpCapabilityPrompt(['  '])).toBe('')
  })

  it('lista servidores y prohíbe negar acceso / inventar tools', () => {
    const prompt = buildMcpCapabilityPrompt(['jira', 'context7'])
    expect(prompt).toContain('## MCP tools available')
    expect(prompt).toContain('- `jira`')
    expect(prompt).toContain('- `context7`')
    expect(prompt).toContain('Do not claim you lack integrated Jira/Atlassian access')
    expect(prompt).toContain('web_fetch')
  })
})
