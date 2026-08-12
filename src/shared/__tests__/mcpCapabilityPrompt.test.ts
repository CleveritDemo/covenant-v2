import { describe, expect, it } from 'vitest'
import { buildJiraAttachedPrompt, buildMcpCapabilityPrompt } from '../mcpCapabilityPrompt'

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

describe('buildJiraAttachedPrompt', () => {
  it('nombra las issues adjuntas y prohíbe volver a buscarlas', () => {
    const prompt = buildJiraAttachedPrompt(['GRAV-412', 'COV-7'])
    expect(prompt).toContain('GRAV-412')
    expect(prompt).toContain('COV-7')
    expect(prompt).toMatch(/do not/i)
  })

  it('sin issues adjuntas no añade nada al turno', () => {
    expect(buildJiraAttachedPrompt([])).toBe('')
  })
})
