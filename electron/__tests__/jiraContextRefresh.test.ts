import { describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TabContext } from '../../src/shared/tabContext'
import type { JiraIssueSnapshot } from '../../src/shared/jiraIssue'

// Estado mutable compartido con el factory de vi.mock (que se hoistea por
// encima de los imports) — mismo patrón que `jiraConfig.test.ts` y
// `tabContextBuildJira.test.ts`. Sin esto, `app.getPath` apuntaría siempre a
// `tmpdir()` (el `/tmp` real, no un subdirectorio de test), y
// `writeJiraCredentials` escribiría `jira-credentials.json` sin cifrar en una
// ruta fija fuera de cualquier `mkdtempSync`, sobreviviendo entre corridas.
const mockState = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')
const { refreshStaleJiraContexts } = await import('../jiraContextRefresh')
const { materializeTabContext } = await import('../tabContextBuild')

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

const context: TabContext = {
  id: 'iaterminal:jira:grav-412',
  name: 'GRAV-412',
  fileName: 'jira/GRAV-412.md',
  kind: 'jira',
  issueKey: 'GRAV-412',
}

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-refresh-'))
  mkdirSync(join(dir, '.gravity', 'jira'), { recursive: true })
  // Credenciales en su propio temp dir, no en el `dir` del proyecto (que es
  // `.gravity/`, no userData) ni en el `tmpdir()` real compartido entre tests.
  mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-userdata-'))
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

describe('refreshStaleJiraContexts', () => {
  it('sin snapshot previo lo crea', async () => {
    const dir = project()
    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('nuevo título')
  })

  it('un snapshot fresco no se vuelve a pedir', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('un snapshot vencido se refresca y conserva las notas', async () => {
    const dir = project()
    writeFileSync(
      issuePath(dir),
      [
        '<!-- iaterminal:auto -->',
        '## Resumen',
        'viejo',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        'la carrera está en loopChainFifo',
        '<!-- /iaterminal:notes -->',
      ].join('\n'),
      'utf8',
    )
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })

    const body = readFileSync(issuePath(dir), 'utf8')
    expect(body).toContain('nuevo título')
    expect(body).toContain('la carrera está en loopChainFifo')
    expect(body).not.toContain('viejo')
  })

  it('si Jira falla, el snapshot anterior queda intacto y no se lanza', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, {
      fetchIssue: async () => { throw new Error('502') },
    })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('viejo')
  })

  it('sin credenciales no hace nada y no lanza', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-refresh-'))
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('ignora los contextos que no son jira', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts(
      [{ id: 'x', name: 'Git', fileName: 'git.md', kind: 'git' }],
      dir,
      { fetchIssue },
    )
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('un issueKey en minúsculas resuelve la misma ruta y clave que contextFilePath', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    const lowercaseContext: TabContext = { ...context, issueKey: 'grav-412' }
    await refreshStaleJiraContexts([lowercaseContext], dir, { fetchIssue })
    expect(fetchIssue).toHaveBeenCalledWith(expect.anything(), 'GRAV-412', 10)
    // No basta con comparar contra `issuePath()` (un literal que este test
    // escribió): hay que pasar por el lector real para pinsar escritor↔lector
    // de punta a punta, que es justo lo que este test existe para verificar.
    const materialized = materializeTabContext(lowercaseContext, dir)
    expect(materialized.ok).toBe(true)
    expect(materialized.content).toContain('nuevo título')
  })

  it('un context jira sin issueKey explícito cae al nombre de archivo, igual que contextFilePath', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    const noKeyContext: TabContext = {
      id: 'iaterminal:jira:grav-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
    }
    await refreshStaleJiraContexts([noKeyContext], dir, { fetchIssue })
    expect(fetchIssue).toHaveBeenCalledWith(expect.anything(), 'GRAV-412', 10)
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('nuevo título')
  })

  // Regresión del round 3: `currentContent` se leía antes del `await
  // fetchIssue`, y el `writeFileSync` final componía desde esa copia
  // pre-fetch. Si otro escritor (p. ej. `mergeAnnotations`, alcanzable para
  // `jira` vía `TAB_CONTEXT_MERGE_ANNOTATIONS`) tocaba el mismo archivo
  // mientras el fetch estaba en vuelo, sus cambios se perdían sin error al
  // volver: el "modify" del read-modify-write leía tarde para la decisión de
  // staleness, pero temprano para el contenido con el que componía. El fix
  // relee justo antes de `withJiraAutoBlock`.
  it('un escritor concurrente durante el fetch no pierde sus cambios (ventana de escritura perdida)', async () => {
    const dir = project()
    writeFileSync(
      issuePath(dir),
      [
        '<!-- iaterminal:auto -->',
        '## Resumen',
        'viejo',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        '(no annotations yet)',
        '<!-- /iaterminal:notes -->',
      ].join('\n'),
      'utf8',
    )
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    // Simula `mergeAnnotations` escribiendo mientras el fetch está en vuelo:
    // el stub muta el archivo en disco (una anotación nueva en `notes`) antes
    // de resolver, imitando la ventana real de `TIMEOUT_MS` en `jiraClient.ts`.
    const fetchIssue = async (): Promise<JiraIssueSnapshot> => {
      writeFileSync(
        issuePath(dir),
        [
          '<!-- iaterminal:auto -->',
          '## Resumen',
          'viejo',
          '<!-- /iaterminal:auto -->',
          '',
          '<!-- iaterminal:notes -->',
          'anotación concurrente de mergeAnnotations',
          '<!-- /iaterminal:notes -->',
        ].join('\n'),
        'utf8',
      )
      return snapshot
    }

    await refreshStaleJiraContexts([context], dir, { fetchIssue })

    const body = readFileSync(issuePath(dir), 'utf8')
    expect(body).toContain('nuevo título')
    expect(body).toContain('anotación concurrente de mergeAnnotations')
  })

  it('un issueKey hostil no escribe fuera de la carpeta del proyecto', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    const hostileContext: TabContext = { ...context, issueKey: '../../evil' }
    await refreshStaleJiraContexts([hostileContext], dir, { fetchIssue })

    const jiraDir = join(dir, '.gravity', 'jira')
    for (const name of readdirSync(jiraDir)) {
      expect(name.includes('..')).toBe(false)
      expect(name.includes('/')).toBe(false)
    }
    expect(existsSync(join(tmpdir(), 'evil.md'))).toBe(false)
    expect(existsSync(join(dir, '..', 'evil.md'))).toBe(false)
    expect(existsSync(join(dir, 'evil.md'))).toBe(false)
  })
})
