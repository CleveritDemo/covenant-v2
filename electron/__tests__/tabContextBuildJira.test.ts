import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverTabContexts, materializeTabContext } from '../tabContextBuild'
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

  // Regresión: la metadata que trae un archivo jira ya en disco no incluye
  // `issueKey` (es el archivo original, escrito antes de que esta metadata lo
  // persistiera). El bug que encontró la revisión era que un contexto así, tal
  // como lo devuelve `discoverTabContexts` — el único camino real por el que
  // la UI obtiene sus contextos —, terminaba siendo inmaterializable porque
  // `applyCanonicalContextIdentity` reescribía `fileName` a `jira/issue.md`.
  it('un contexto jira descubierto de disco (metadata sin issueKey) se materializa igual', () => {
    const dir = projectWithIssue([
      '# GRAV-412',
      '<!-- iaterminal:context {"version":1,"id":"iaterminal:jira:GRAV-412","name":"GRAV-412","fileName":"jira/GRAV-412.md","kind":"jira","icon":"jira","color":"#2684ff"} -->',
      '',
      '<!-- iaterminal:auto -->',
      '## Resumen',
      'GRAV-412',
      '<!-- /iaterminal:auto -->',
      '',
      '<!-- iaterminal:notes -->',
      '(no annotations yet)',
      '<!-- /iaterminal:notes -->',
      '',
    ].join('\n'))

    const discovered = discoverTabContexts(dir)
    expect(discovered.ok).toBe(true)
    const jiraContext = discovered.contexts.find(c => c.kind === 'jira')
    expect(jiraContext).toBeDefined()

    // No se fija `issueKey` a mano: se usa el objeto tal como lo entrega el
    // descubrimiento, que ya lo reconstruyó del id/fileName reales.
    const result = materializeTabContext(jiraContext as TabContext, dir)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
    expect(result.filePath).toBe(join(dir, '.gravity', 'jira', 'GRAV-412.md'))
  })
})
