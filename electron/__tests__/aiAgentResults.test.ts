import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  agentResultFileName,
  extractAiAgentResults,
  resolveAiAgentResultsPath,
  upsertAiAgentResults,
} from '../aiAgentResults'

describe('AI agent results', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-results-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('extracts and hides structured results from the final answer', () => {
    const result = extractAiAgentResults([
      'Listo.',
      '```ia-terminal-results',
      '{"summary":"API lista","entries":["Añadí el endpoint /health"]}',
      '```',
    ].join('\n'))

    expect(result.visibleText).toBe('Listo.')
    expect(result.payload).toEqual({
      summary: 'API lista',
      entries: ['Añadí el endpoint /health'],
    })
  })

  it('writes Latest and prepends Log entries under .iaterminal/results/', () => {
    const cwd = tempCwd()
    upsertAiAgentResults(cwd, 'Ops Bot', {
      summary: 'Primera entrega',
      entries: ['Creé el scaffold'],
    }, '2026-01-01T00:00:00.000Z')
    upsertAiAgentResults(cwd, 'Ops Bot', {
      summary: 'Segunda entrega',
      entries: ['Ajusté tests'],
    }, '2026-01-02T00:00:00.000Z')

    const filePath = resolveAiAgentResultsPath(cwd, 'Ops Bot')
    expect(filePath).toBe(join(cwd, '.iaterminal', 'results', 'Ops-Bot.md'))
    expect(existsSync(filePath)).toBe(true)
    const raw = readFileSync(filePath, 'utf8')
    expect(raw).toContain('## Latest')
    expect(raw).toContain('Segunda entrega')
    expect(raw).toContain('`2026-01-02T00:00:00.000Z` — Ajusté tests')
    expect(raw).toContain('`2026-01-01T00:00:00.000Z` — Creé el scaffold')
    expect(raw).toContain(`"fileName":"${agentResultFileName('Ops Bot')}"`)
    expect(raw).toContain('"kind":"agentResult"')
  })

  it('rejects empty summary payloads', () => {
    const result = extractAiAgentResults([
      '```ia-terminal-results',
      '{"summary":"   ","entries":["x"]}',
      '```',
    ].join('\n'))
    expect(result.payload).toBeNull()
  })
})
