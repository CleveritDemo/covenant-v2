import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import type { JiraIssueRef } from '../../src/shared/jiraIssue'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Mismo patrón que jiraConfig.test.ts: `vi.mock` se hoistea por encima de los
// imports, así que el estado mutable vive en `vi.hoisted` y cada test apunta
// `app.getPath` a su propio directorio temporal.
const mockState = vi.hoisted(() => ({
  userDataDir: '',
}))

vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

import { CONFIG_DEFAULTS, type AppConfig } from '../../src/shared/configSchema'

const jiraMyself = vi.fn()
const jiraSearch = vi.fn()
// `jiraGetIssue` va en el mock aunque estos tests no lo llamen: el refresher lo
// importa, y un export ausente en la factory revienta al resolverse.
const jiraGetIssue = vi.fn()
vi.mock('../jiraClient', () => ({ jiraMyself, jiraSearch, jiraGetIssue }))

const { jiraStatusFor, connectJira, disconnectJira, searchJiraQuick, previewJiraIssue, bindJiraConfigAccess } =
  await import('../jiraIpcOps')
const { refreshStaleJiraContexts, clearJiraRefreshFailures } = await import('../jiraContextRefresh')
const { readJiraConfig, writeJiraConfig, readJiraCredentials, writeJiraCredentials } =
  await import('../jiraConfig')
const { readJiraToken, writeJiraToken } = await import('../jiraAccountStore')

function bindTestConfig(initial: Partial<AppConfig> = {}) {
  let config: AppConfig = { ...CONFIG_DEFAULTS, ...initial }
  bindJiraConfigAccess({
    read: () => config,
    write: next => {
      config = next
    },
  })
  return { getConfig: () => config }
}

function setupLegacyCredentials(dir: string): void {
  bindTestConfig({ jiraAccounts: [], jiraDefaultAccountId: '' })
  writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
}

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

beforeEach(() => {
  mockState.userDataDir = tmp('gravity-jira-userdata-')
  bindTestConfig()
  jiraMyself.mockReset().mockResolvedValue({ ok: true, displayName: 'Ana' })
  jiraSearch.mockReset().mockResolvedValue([])
  // La memoria de fallos del refresher es de módulo: sin limpiarla, un test
  // que provoca un fallo castigaría al siguiente.
  clearJiraRefreshFailures()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('jiraStatusFor', () => {
  it('sin jira.json: ni configurado ni conectado', () => {
    const dir = tmp('gravity-jira-proj-')
    expect(jiraStatusFor(dir)).toEqual({
      configured: false,
      site: '',
      email: '',
      accountId: '',
      accountLabel: '',
      projectKeys: [],
      connected: false,
    })
  })

  it('con jira.json pero sin credenciales guardadas: configurado, no conectado', () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    expect(jiraStatusFor(dir)).toEqual({
      configured: true,
      site: 'https://x.atlassian.net',
      email: '',
      accountId: '',
      accountLabel: '',
      projectKeys: ['GRAV'],
      connected: false,
    })
  })

  it('con credenciales guardadas para ese sitio: connected true', () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    expect(jiraStatusFor(dir).connected).toBe(true)
  })

  it('devuelve el email guardado: sin él, Ajustes no puede repintar el formulario', () => {
    // El email no es secreto (el secreto es el token). Sin devolverlo, el campo
    // sale vacío al reabrir Ajustes y el reintento manda email vacío → 401
    // encima de una conexión que funcionaba.
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    expect(jiraStatusFor(dir).email).toBe('a@x.com')
  })

  it('cwd vacío (pestaña sin proyecto): DISCONNECTED, no mira el cwd del proceso', () => {
    // `projectDirPath('')` resuelve a `process.cwd()`: en dev, el repo de
    // Gravity; empaquetado desde Finder, `/`. Reportar ese `jira.json` como si
    // fuera el de la pestaña es mentir sobre a qué proyecto pertenece.
    expect(jiraStatusFor('')).toEqual({
      configured: false,
      site: '',
      email: '',
      accountId: '',
      accountLabel: '',
      projectKeys: [],
      connected: false,
    })
    expect(jiraStatusFor('   ')).toEqual({
      configured: false,
      site: '',
      email: '',
      accountId: '',
      accountLabel: '',
      projectKeys: [],
      connected: false,
    })
  })
})

describe('connectJira', () => {
  it('probe ok: persiste config y cuenta del llavero, no filtra el token en la respuesta', async () => {
    const dir = tmp('gravity-jira-proj-')
    const state = bindTestConfig()
    const result = await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok-secreto',
      projectKeys: ['grav'],
    })

    expect(result).toMatchObject({ ok: true, displayName: 'Ana' })
    expect(JSON.stringify(result)).not.toContain('tok-secreto')
    expect(readJiraConfig(dir)?.projectKeys).toEqual(['GRAV'])
    const config = state.getConfig()
    expect(config.jiraAccounts).toHaveLength(1)
    expect(config.jiraAccounts[0]?.email).toBe('a@x.com')
    expect(readJiraToken(config.jiraAccounts[0]!.id)).toBe('tok-secreto')
  })

  it('sitio no https: rechaza antes de probar credenciales, no persiste nada', async () => {
    const dir = tmp('gravity-jira-proj-')
    const result = await connectJira(dir, {
      site: 'http://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok',
      projectKeys: [],
    })

    expect(result.ok).toBe(false)
    expect(jiraMyself).not.toHaveBeenCalled()
    expect(readJiraConfig(dir)).toBeNull()
  })

  it('probe falla (credenciales inválidas): no persiste nada, propaga el error del probe', async () => {
    jiraMyself.mockResolvedValue({ ok: false, error: 'Jira 401' })
    const dir = tmp('gravity-jira-proj-')

    const result = await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'mal',
      projectKeys: [],
    })

    expect(result).toEqual({ ok: false, error: 'Jira 401' })
    expect(readJiraConfig(dir)).toBeNull()
    expect(readJiraCredentials('https://x.atlassian.net')).toBeNull()
  })

  it('carried finding Task 3: un fallo de escritura vuelve ok:false, no rechaza la promesa', async () => {
    // `writeJiraConfig` hace mkdirSync/writeFileSync sin try/catch propio; el
    // guard vive aquí. Se fuerza el fallo con un cwd cuyo componente de ruta
    // es un archivo, no una carpeta: mkdirSync recursivo revienta con ENOTDIR.
    const blockerDir = tmp('gravity-jira-blocker-')
    const notADir = join(blockerDir, 'esto-es-un-archivo')
    writeFileSync(notADir, 'no soy una carpeta', 'utf8')
    const brokenCwd = join(notADir, 'sub')

    await expect(
      connectJira(brokenCwd, {
        site: 'https://x.atlassian.net',
        email: 'a@x.com',
        apiToken: 'tok',
        projectKeys: [],
      }),
    ).resolves.toMatchObject({ ok: false })
  })

  it('cwd vacío: rechaza sin tocar la red ni escribir en el cwd del proceso', async () => {
    const result = await connectJira('', {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok',
      projectKeys: [],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/proyecto/i)
    expect(jiraMyself).not.toHaveBeenCalled()
  })

  it('reconectar CONSERVA defaultJql, refreshSeconds y maxComments puestos a mano', async () => {
    // Esos tres campos no tienen UI: editar `jira.json` es la única forma de
    // fijarlos, y ese archivo se commitea. Una rotación de token meses después
    // no puede borrarle al equipo el JQL y el intervalo que afinó.
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'project = GRAV AND labels = infra',
      refreshSeconds: 120,
      maxComments: 3,
    })

    await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok-nuevo',
      projectKeys: ['grav', 'cov'],
    })

    expect(readJiraConfig(dir)).toEqual({
      site: 'https://x.atlassian.net',
      // lo que el formulario sí pidió cambiar
      projectKeys: ['GRAV', 'COV'],
      // lo que nadie tocó
      defaultJql: 'project = GRAV AND labels = infra',
      refreshSeconds: 120,
      maxComments: 3,
    })
  })

  it('al conectar, ignora los snapshots en el .gitignore del proyecto', async () => {
    const dir = tmp('gravity-jira-proj-')
    mkdirSync(join(dir, '.git'), { recursive: true })
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n', 'utf8')

    const result = await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok',
      projectKeys: [],
    })

    expect(result.gitignore).toBe('appended')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('/jira/')
  })
})

describe('connectJira ↔ memoria de fallos del refresher', () => {
  const context = {
    id: 'iaterminal:jira:grav-412',
    name: 'GRAV-412',
    fileName: 'jira/GRAV-412.md',
    kind: 'jira' as const,
    issueKey: 'GRAV-412',
  }

  const snapshot = {
    key: 'GRAV-412',
    summary: 'nuevo título',
    status: 'Done',
    issueType: 'Bug',
    assignee: null,
    priority: null,
    sprint: null,
    updated: '2026-08-12T09:40:00.000Z',
    url: 'https://x.atlassian.net/browse/GRAV-412',
    description: 'cuerpo',
    acceptanceCriteria: null,
    comments: [],
    subtasks: [],
    links: [],
  }

  function configuredProject(): string {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'project = GRAV',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'viejo' })
    return dir
  }

  it('reconectar olvida el castigo: el refresco vuelve a intentarlo enseguida', async () => {
    // El fallo real: expira el token, cada issue adjunta anota su `site:KEY`,
    // el usuario reconecta bien... y durante hasta cinco minutos no se refresca
    // nada, los chips siguen vencidos y nada lo explica.
    const dir = configuredProject()
    const failing = vi.fn(async () => { throw new Error('Jira 401') })

    await refreshStaleJiraContexts([context], dir, { fetchIssue: failing })
    await refreshStaleJiraContexts([context], dir, { fetchIssue: failing })
    // El cooldown está activo: la segunda pasada ni lo intentó.
    expect(failing).toHaveBeenCalledTimes(1)

    const result = await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'token-nuevo',
      projectKeys: ['GRAV'],
    })
    expect(result.ok).toBe(true)

    const ok = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue: ok })

    expect(ok).toHaveBeenCalledTimes(1)
    expect(readFileSync(join(dir, '.gravity', 'jira', 'GRAV-412.md'), 'utf8')).toContain('nuevo título')
  })

  it('un connect FALLIDO no olvida el castigo', async () => {
    // Solo un connect que llegó a persistir es señal de que la causa del fallo
    // pudo desaparecer; un 401 en el probe no lo es.
    const dir = configuredProject()
    const failing = vi.fn(async () => { throw new Error('Jira 401') })
    await refreshStaleJiraContexts([context], dir, { fetchIssue: failing })

    jiraMyself.mockResolvedValue({ ok: false, error: 'Jira 401' })
    await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'sigue-mal',
      projectKeys: ['GRAV'],
    })

    const ok = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue: ok })
    expect(ok).not.toHaveBeenCalled()
  })
})

describe('disconnectJira', () => {
  it('olvida la credencial pero deja el jira.json del proyecto', () => {
    // `jira.json` está commiteado y es del equipo: desconectarse en la máquina
    // de uno no puede cambiarle la configuración a los demás.
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })

    expect(disconnectJira(dir)).toEqual({ ok: true })

    expect(readJiraCredentials('https://x.atlassian.net')).toBeNull()
    expect(readJiraConfig(dir)?.projectKeys).toEqual(['GRAV'])
    expect(jiraStatusFor(dir)).toMatchObject({ configured: true, connected: false })
  })

  it('sin proyecto abierto, no hace nada', () => {
    expect(disconnectJira('').ok).toBe(false)
  })

  it('sin jira.json, es un no-op exitoso', () => {
    expect(disconnectJira(tmp('gravity-jira-proj-'))).toEqual({ ok: true })
  })
})

describe('searchJiraQuick', () => {
  it('sin jira.json: sin resultados y con motivo, no llama a la red', async () => {
    const dir = tmp('gravity-jira-proj-')
    const out = await searchJiraQuick(dir, 'algo')
    expect(out.issues).toEqual([])
    expect(out.error).toBeTruthy()
    expect(jiraSearch).not.toHaveBeenCalled()
  })

  it('con jira.json pero sin credenciales guardadas: array vacío, no llama a la red', async () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    const out = await searchJiraQuick(dir, 'algo')
    expect(out.issues).toEqual([])
    expect(out.error).toBeTruthy()
    expect(jiraSearch).not.toHaveBeenCalled()
  })

  it('con credenciales: construye el JQL difuso y delega en jiraSearch', async () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    const issues = [{ key: 'GRAV-1', summary: 's', status: 'Open', issueType: 'Bug', assignee: null, updated: '2026-08-12T09:40:00.000Z' }]
    jiraSearch.mockResolvedValue(issues)

    // Texto libre, no un prefijo de clave: esta es la rama difusa.
    const out = await searchJiraQuick(dir, 'login roto')

    expect(out.issues).toBe(issues)
    expect(out.error).toBeUndefined()
    expect(jiraSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        site: 'https://x.atlassian.net',
        email: 'a@x.com',
        apiToken: 'tok',
      }),
      'project in (GRAV) AND (summary ~ "login roto*" OR text ~ "login roto*") ORDER BY updated DESC',
      8,
    )
  })

  it('prefijo de clave: pide el proyecto y recorta por clave en el cliente', async () => {
    // El caso que motivó esto: teclear `CT-` no devolvía nada porque el `~` de
    // Jira no indexa la clave. Ahora se piden las issues recientes del proyecto
    // y el recorte por dígitos se hace aquí.
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['CDLC-TRANSFORMATION'],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    const ref = (key: string): JiraIssueRef =>
      ({ key, summary: key, status: 'Open', issueType: 'Bug', assignee: null, updated: '2026-08-12T09:40:00.000Z' })
    jiraSearch.mockResolvedValue([ref('CT-128'), ref('CT-12'), ref('CT-9'), ref('CT-200')])

    const out = await searchJiraQuick(dir, 'CT-12')

    expect(out.issues.map(issue => issue.key)).toEqual(['CT-128', 'CT-12'])
    expect(jiraSearch).toHaveBeenCalledWith(
      expect.anything(),
      'project = CT ORDER BY updated DESC',
      50,
    )
  })

  it('prefijo sin dígitos devuelve el proyecto entero, sin recortar', async () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    const ref = (key: string): JiraIssueRef =>
      ({ key, summary: key, status: 'Open', issueType: 'Bug', assignee: null, updated: '2026-08-12T09:40:00.000Z' })
    jiraSearch.mockResolvedValue([ref('CT-1'), ref('CT-2')])

    expect((await searchJiraQuick(dir, 'CT-')).issues.map(i => i.key)).toEqual(['CT-1', 'CT-2'])
  })

  it('jiraSearch rechaza: sin resultados, con el motivo, y sin propagar el rechazo', async () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    jiraSearch.mockRejectedValue(new Error('timeout'))

    const out = await searchJiraQuick(dir, 'algo')
    expect(out.issues).toEqual([])
    expect(out.error).toContain('timeout')
  })
})

describe('previewJiraIssue', () => {
  function project(): string {
    const dir = tmp('gravity-jira-preview-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'project = GRAV',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    return dir
  }

  const issue = {
    key: 'GRAV-412',
    summary: 'Loop chain colgada',
    status: 'In Progress',
    issueType: 'Bug',
    assignee: 'Rodrigo',
    priority: null,
    sprint: null,
    updated: '2026-08-12T09:40:00.000Z',
    url: 'https://x.atlassian.net/browse/GRAV-412',
    description: 'El FIFO no libera el slot.',
    acceptanceCriteria: null,
    comments: [],
    subtasks: [],
    links: [],
  }

  it('devuelve el MISMO Markdown que acabará en el .md, no un resumen aparte', async () => {
    const dir = project()
    jiraGetIssue.mockResolvedValue(issue)

    const result = await previewJiraIssue(dir, 'grav-412')

    expect(result.ok).toBe(true)
    // Compuesto por `issueAutoMarkdown`, el escritor del refrescador: si la
    // vista previa usara su propio formato, mostraría algo que el agente nunca
    // recibe.
    expect(result.content).toContain('## Resumen')
    expect(result.content).toContain('GRAV-412 · Loop chain colgada')
    expect(result.content).toContain('El FIFO no libera el slot.')
    // La clave se normaliza antes de salir a la red.
    expect(jiraGetIssue).toHaveBeenCalledWith(expect.anything(), 'GRAV-412', 10)
  })

  it('no escribe nada en disco: la vista previa no crea el contexto', async () => {
    const dir = project()
    jiraGetIssue.mockResolvedValue(issue)

    await previewJiraIssue(dir, 'GRAV-412')

    expect(existsSync(join(dir, '.gravity', 'jira', 'GRAV-412.md'))).toBe(false)
  })

  it('una clave inválida ni siquiera sale a la red', async () => {
    const dir = project()
    expect((await previewJiraIssue(dir, 'no soy una clave')).ok).toBe(false)
    expect(jiraGetIssue).not.toHaveBeenCalled()
  })

  it('sin proyecto abierto no resuelve contra process.cwd()', async () => {
    expect((await previewJiraIssue('', 'GRAV-412')).ok).toBe(false)
    expect(jiraGetIssue).not.toHaveBeenCalled()
  })

  it('un fallo de Jira vuelve como error legible, no como excepción', async () => {
    const dir = project()
    jiraGetIssue.mockRejectedValue(new Error('Jira 404'))

    const result = await previewJiraIssue(dir, 'GRAV-999')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('404')
  })
})
