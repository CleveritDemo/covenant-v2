import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'

const context: TabContext = {
  id: 'iaterminal:jira:grav-412',
  name: 'GRAV-412',
  fileName: 'jira/GRAV-412.md',
  kind: 'jira',
  issueKey: 'GRAV-412',
}

function projectWithIssue(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ctx-'))
  mkdirSync(join(dir, '.gravity', 'jira'), { recursive: true })
  writeFileSync(join(dir, '.gravity', 'jira', 'GRAV-412.md'), body, 'utf8')
  return dir
}

describe('materializeTabContext con kind jira', () => {
  it('lee el archivo del disco tal cual: no llama a nadie', () => {
    const dir = projectWithIssue('<!-- iaterminal:auto -->\n## Resumen\nGRAV-412\n<!-- /iaterminal:auto -->')
    const result = materializeTabContext(context, dir)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
    expect(result.filePath).toBe(join(dir, '.gravity', 'jira', 'GRAV-412.md'))
  })

  it('sin snapshot todavía devuelve ok:false, no una excepción', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ctx-'))
    expect(materializeTabContext(context, dir).ok).toBe(false)
  })
})
