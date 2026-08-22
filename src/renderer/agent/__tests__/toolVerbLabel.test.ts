import { describe, expect, it } from 'vitest'
import { toolVerbLabel } from '../toolVerbLabel'

function t(key: string, vars?: Record<string, string | number>): string {
  if (!vars) return `[${key}]`
  const payload = Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(',')
  return `[${key}|${payload}]`
}

describe('toolVerbLabel', () => {
  it('maps todo tools to plan (before write)', () => {
    expect(toolVerbLabel('TodoWrite', 'list.md', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.plan]]')
  })

  it('maps web tools to web (before search)', () => {
    expect(toolVerbLabel('Web search', 'react hooks', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.web],target=react hooks]')
    expect(toolVerbLabel('WebFetch', 'https://example.com', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.web],target=https://example.com]')
  })

  it('maps task tools to delegate (always bare)', () => {
    expect(toolVerbLabel('Task', 'backend', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.delegate]]')
    expect(toolVerbLabel('Subagent', 'qa', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.delegate]]')
  })

  it('maps read tools to read with target when detail is present', () => {
    expect(toolVerbLabel('Read file', 'src/foo.ts', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.read],target=src/foo.ts]')
    expect(toolVerbLabel('Read', undefined, t))
      .toBe('[toolVerb.bare|verb=[toolVerb.read]]')
  })

  it('maps edit tools to edit', () => {
    expect(toolVerbLabel('File change', 'app.ts', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.edit],target=app.ts]')
    expect(toolVerbLabel('Write', 'out.md', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.edit],target=out.md]')
  })

  it('maps run tools to run', () => {
    expect(toolVerbLabel('Command execution', 'npm test', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.run],target=npm test]')
    expect(toolVerbLabel('Bash', 'ls', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.run],target=ls]')
  })

  it('maps search tools to search', () => {
    expect(toolVerbLabel('Grep', 'pattern', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.search],target=pattern]')
    expect(toolVerbLabel('Glob', '*.ts', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.search],target=*.ts]')
    expect(toolVerbLabel('Ls', 'src', t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.search],target=src]')
    expect(toolVerbLabel('Tools', 'x', t)).toBeNull()
  })

  it('maps mcp tools to tool (always bare)', () => {
    expect(toolVerbLabel('MCP filesystem', 'read', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.tool]]')
  })

  it('returns null for unknown tool names', () => {
    expect(toolVerbLabel('TotallyUnknown', 'x', t)).toBeNull()
  })

  it('uses bare form when detail is empty', () => {
    expect(toolVerbLabel('Read', '', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.read]]')
    expect(toolVerbLabel('Read', '   ', t))
      .toBe('[toolVerb.bare|verb=[toolVerb.read]]')
  })
})
