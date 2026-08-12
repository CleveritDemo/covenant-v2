import { describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverTabContexts, materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'
import type { JiraIssueSnapshot } from '../../src/shared/jiraIssue'

// Solo el bloque "alta sin snapshot" necesita jiraConfig/jiraContextRefresh
// (que sí tocan `electron.safeStorage`); el resto de los tests de este
// archivo nunca llama a la red y no necesitan el mock.
vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')
const { refreshStaleJiraContexts } = await import('../jiraContextRefresh')

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

const snapshot: JiraIssueSnapshot = {
  key: 'GRAV-412',
  summary: 'nuevo título',
  status: 'Done',
  issueType: 'Bug',
  assignee: 'Rodrigo',
  priority: null,
  sprint: null,
  updated: '2026-08-12T09:40:00.000Z',
  url: 'https://x.atlassian.net/browse/GRAV-412',
  description: 'cuerpo nuevo',
  acceptanceCriteria: null,
  comments: [],
  subtasks: [],
  links: [],
}

/** Proyecto con Jira conectado, para que `refreshStaleJiraContexts` no salga temprano. */
function configuredProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-create-'))
  writeJiraConfig(dir, {
    site: 'https://x.atlassian.net',
    projectKeys: ['GRAV'],
    defaultJql: 'project = GRAV',
    refreshSeconds: 900,
    maxComments: 10,
  })
  writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' })
  return dir
}

const issuePath = (dir: string): string => join(dir, '.gravity', 'jira', 'GRAV-412.md')

// El hueco que cerró la revisión: sin esto, "conectar Jira → crear el
// contexto con la clave → Guardar" se quedaba en "No snapshot yet." para
// siempre, porque nada más escribe ese archivo antes de que exista un turno
// que lo adjunte.
describe('materializeTabContext con kind jira — alta desde el gestor (write:true)', () => {
  it('sin snapshot y write:true crea un placeholder en la ruta que resuelve contextFilePath', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-create-'))
    const result = materializeTabContext(context, dir, { write: true })
    expect(result.ok).toBe(true)
    expect(result.filePath).toBe(issuePath(dir))
    expect(existsSync(issuePath(dir))).toBe(true)
    expect(result.content).toContain('<!-- iaterminal:auto -->')
    expect(result.content).toContain('<!-- iaterminal:notes -->')
  })

  it('con snapshot ya existente, write:true no lo pisa (comportamiento sin cambios)', () => {
    const dir = projectWithIssue('<!-- iaterminal:auto -->\n## Resumen\nGRAV-412\n<!-- /iaterminal:auto -->')
    const result = materializeTabContext(context, dir, { write: true })
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
  })

  it('el placeholder creado se descubre por discoverTabContexts (jira/*.md)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-create-'))
    materializeTabContext(context, dir, { write: true })

    const discovered = discoverTabContexts(dir)
    expect(discovered.ok).toBe(true)
    const jiraContext = discovered.contexts.find(c => c.kind === 'jira')
    expect(jiraContext?.issueKey).toBe('GRAV-412')
    expect(jiraContext?.fileName).toBe('jira/GRAV-412.md')
  })

  it('un refresh posterior rellena la región auto sin recrear el archivo', async () => {
    const dir = configuredProject()
    const created = materializeTabContext(context, dir, { write: true })
    expect(created.ok).toBe(true)
    // El placeholder recién creado no está "vencido": se retrocede su mtime,
    // igual que hace `jiraContextRefresh.test.ts` para forzar el refresco.
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })

    const body = materializeTabContext(context, dir).content
    expect(body).toContain('nuevo título')
    expect(body).toContain('<!-- iaterminal:notes -->')
  })
})
