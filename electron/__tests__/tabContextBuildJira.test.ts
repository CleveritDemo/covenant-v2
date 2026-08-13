import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverTabContexts, materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'
import type { JiraIssueSnapshot } from '../../src/shared/jiraIssue'

// Estado mutable compartido con el factory de vi.mock (que se hoistea por
// encima de los imports) — mismo patrón que `electron/__tests__/jiraConfig.test.ts`.
// Sin esto, `app.getPath` apuntaría siempre a `tmpdir()` (el `/tmp` real, no
// un subdirectorio de test), y `writeJiraCredentials` escribiría
// `jira-credentials.json` sin cifrar en una ruta fija fuera de cualquier
// `mkdtempSync`, sobreviviendo entre corridas de la suite.
const mockState = vi.hoisted(() => ({ userDataDir: '' }))

// Solo el bloque "alta sin snapshot" necesita jiraConfig/jiraContextRefresh
// (que sí tocan `electron.safeStorage`); el resto de los tests de este
// archivo nunca llama a la red y no necesitan el mock.
vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')
const { refreshStaleJiraContexts, clearJiraRefreshFailures } = await import('../jiraContextRefresh')

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

// El hueco que cerró la revisión: sin esto, "conectar Jira → crear el
// contexto con la clave → Guardar" se quedaba en "No snapshot yet." para
// siempre, porque nada más escribe ese archivo antes de que exista un turno
// que lo adjunte.
describe('materializeTabContext con kind jira — alta desde el gestor (write:true)', () => {
  // La memoria de fallos del refresher es de módulo: sin limpiarla, un test
  // que provoca un 502 castigaría a los siguientes.
  beforeEach(() => {
    clearJiraRefreshFailures()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

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

  // El camino real de usuario: conectar Jira, crear el contexto, adjuntarlo y
  // mandar un turno un minuto después (mtime del placeholder fresco, muy por
  // debajo de refreshSeconds). Antes del fix del round 2, esto NO refrescaba
  // — `isSnapshotStale` por mtime lo daba por vigente — y el turno recibía la
  // región auto vacía del placeholder, indistinguible de una issue sin
  // contenido, durante hasta refreshSeconds (15 min por defecto). Sin
  // back-datear el mtime a propósito, para probar justo eso.
  it('un refresh inmediato (mtime fresco) rellena el placeholder: el contenido vacío manda sobre el mtime', async () => {
    const dir = configuredProject()
    const created = materializeTabContext(context, dir, { write: true })
    expect(created.ok).toBe(true)

    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })

    const body = materializeTabContext(context, dir).content
    expect(body).toContain('nuevo título')
    expect(body).toContain('<!-- iaterminal:notes -->')
  })

  it('un refresh posterior (mtime vencido) también rellena la región auto sin recrear el archivo', async () => {
    const dir = configuredProject()
    const created = materializeTabContext(context, dir, { write: true })
    expect(created.ok).toBe(true)
    // Camino alternativo al de arriba: mtime vencido por tiempo, no por
    // contenido vacío. Ambas rutas deben converger en el mismo refresco.
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })

    const body = materializeTabContext(context, dir).content
    expect(body).toContain('nuevo título')
    expect(body).toContain('<!-- iaterminal:notes -->')
  })

  it('un fetch fallido tras el placeholder no deja el mtime fresco bloqueando el próximo intento', async () => {
    const dir = configuredProject()
    materializeTabContext(context, dir, { write: true })

    // Primer intento: Jira caído. El snapshot en disco sigue siendo el
    // placeholder vacío (no se escribe nada si fetchIssue lanza).
    await refreshStaleJiraContexts([context], dir, {
      fetchIssue: async () => { throw new Error('502') },
    })
    expect(materializeTabContext(context, dir).content).toContain('(no annotations yet)')

    // Segundo intento, inmediatamente después (mismo mtime fresco del
    // placeholder original): antes del fix del round 2 este turno también se
    // habría saltado el fetch por mtime, agravando la ventana de silencio de
    // una falla transitoria a los refreshSeconds completos.
    // `failureCooldownMs: 0` aísla lo que este test mira: hoy hay ADEMÁS un
    // backoff por fallo (`jiraContextRefresh.test.ts` lo cubre aparte), y sin
    // vencerlo el reintento inmediato no distinguiría cuál de los dos frenos
    // actuó.
    await refreshStaleJiraContexts([context], dir, {
      fetchIssue: async () => snapshot,
      failureCooldownMs: 0,
    })
    expect(materializeTabContext(context, dir).content).toContain('nuevo título')
  })
})
