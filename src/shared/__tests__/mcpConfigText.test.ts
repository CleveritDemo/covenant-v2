import { describe, expect, it } from 'vitest'
import { validateMcpConfigText } from '../mcpConfigText'

describe('validateMcpConfigText', () => {
  it('accepts a config and lists its server names', () => {
    const result = validateMcpConfigText('{"mcpServers":{"jira":{"type":"sse"},"ctx":{}}}')
    expect(result).toEqual({ ok: true, servers: ['jira', 'ctx'] })
  })

  it('accepts a file without mcpServers (gemini settings.json keeps other keys)', () => {
    expect(validateMcpConfigText('{"theme":"dark"}')).toEqual({ ok: true, servers: [] })
  })

  it('rejects broken JSON and keeps the parser message', () => {
    const result = validateMcpConfigText('{"mcpServers":')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-json')
    expect(result.detail).toBeTruthy()
  })

  it('rejects empty text instead of writing an empty file', () => {
    expect(validateMcpConfigText('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a top level that is not an object', () => {
    expect(validateMcpConfigText('[1,2]').ok).toBe(false)
    expect(validateMcpConfigText('"texto"').ok).toBe(false)
    expect(validateMcpConfigText('null').ok).toBe(false)
  })

  it('rejects mcpServers that is not an object', () => {
    const result = validateMcpConfigText('{"mcpServers":["jira"]}')
    expect(result).toEqual({ ok: false, reason: 'servers-not-object' })
  })
})
