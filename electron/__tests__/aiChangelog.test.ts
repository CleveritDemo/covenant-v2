import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendAiChangelog,
  ensureAiChangelog,
  extractAiChangelog,
  readAiChangelog,
} from '../aiChangelog'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('AI changelog', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-changelog-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('extracts and hides structured changes from the final answer', () => {
    const result = extractAiChangelog([
      'Trabajo terminado.',
      '```ia-terminal-changelog',
      '{"changes":[{"path":"src/a.ts","description":"Actualicé la validación"},{"path":"src/inventado.ts","description":"Cambio inventado"}]}',
      '```',
    ].join('\n'), ['src/a.ts'])

    expect(result.visibleText).toBe('Trabajo terminado.')
    expect(result.changes).toEqual([
      { path: 'src/a.ts', description: 'Actualicé la validación' },
    ])
  })

  it('keeps only the latest 10 changes and limits each to 30 words', () => {
    const cwd = tempCwd()
    ensureAiChangelog(cwd)
    appendAiChangelog(cwd, Array.from({ length: 8 }, (_, index) => ({
      path: `src/anterior-${index}.ts`,
      description: `Anterior ${index}`,
    })), '2026-01-01T00:00:00.000Z')
    appendAiChangelog(cwd, [
      {
        path: 'src/largo.ts',
        description: Array.from({ length: 35 }, (_, index) => `palabra${index}`).join(' '),
      },
      { path: 'src/reciente.ts', description: 'Cambio más reciente' },
      { path: 'src/otro.ts', description: 'Otro cambio reciente' },
    ], '2026-01-02T00:00:00.000Z')

    const entries = readAiChangelog(cwd)
    expect(entries).toHaveLength(10)
    expect(entries[0].description.split(/\s+/)).toHaveLength(30)
    expect(entries[0].path).toBe('src/largo.ts')
    expect(entries[1].description).toBe('Cambio más reciente')
    expect(entries.at(-1)?.description).toBe('Anterior 6')
    expect(readFileSync(join(cwd, PROJECT_DIR, 'changelog.md'), 'utf8'))
      .toContain('# AI Changelog')
  })

  it('removes the oldest entry when an eleventh change is added', () => {
    const cwd = tempCwd()
    ensureAiChangelog(cwd)
    for (let index = 1; index <= 11; index += 1) {
      appendAiChangelog(cwd, [{
        path: `src/change-${index}.ts`,
        description: `Cambio ${index}`,
      }], `2026-01-${String(index).padStart(2, '0')}T00:00:00.000Z`)
    }

    const entries = readAiChangelog(cwd)
    expect(entries).toHaveLength(10)
    expect(entries[0]).toMatchObject({ path: 'src/change-11.ts', description: 'Cambio 11' })
    expect(entries.at(-1)).toMatchObject({ path: 'src/change-2.ts', description: 'Cambio 2' })
    expect(entries.some(entry => entry.path === 'src/change-1.ts')).toBe(false)
  })

  it('does not create a changelog when its context was not configured', () => {
    const cwd = tempCwd()

    appendAiChangelog(cwd, [{
      path: 'src/change.ts',
      description: 'No debe crear archivo implícitamente',
    }])

    expect(existsSync(join(cwd, PROJECT_DIR, 'changelog.md'))).toBe(false)
  })
})
