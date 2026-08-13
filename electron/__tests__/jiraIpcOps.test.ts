import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
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

const jiraMyself = vi.fn()
const jiraSearch = vi.fn()
vi.mock('../jiraClient', () => ({ jiraMyself, jiraSearch }))

const { jiraStatusFor, connectJira, disconnectJira, searchJiraQuick } = await import('../jiraIpcOps')
const { readJiraConfig, writeJiraConfig, readJiraCredentials, writeJiraCredentials } =
  await import('../jiraConfig')

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

beforeEach(() => {
  mockState.userDataDir = tmp('gravity-jira-userdata-')
  jiraMyself.mockReset().mockResolvedValue({ ok: true, displayName: 'Ana' })
  jiraSearch.mockReset().mockResolvedValue([])
})

describe('jiraStatusFor', () => {
  it('sin jira.json: ni configurado ni conectado', () => {
    const dir = tmp('gravity-jira-proj-')
    expect(jiraStatusFor(dir)).toEqual({
      configured: false,
      site: '',
      email: '',
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
      projectKeys: [],
      connected: false,
    })
    expect(jiraStatusFor('   ')).toEqual({
      configured: false,
      site: '',
      email: '',
      projectKeys: [],
      connected: false,
    })
  })
})

describe('connectJira', () => {
  it('probe ok: persiste config y credenciales, no filtra el token en la respuesta', async () => {
    const dir = tmp('gravity-jira-proj-')
    const result = await connectJira(dir, {
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok-secreto',
      projectKeys: ['grav'],
    })

    expect(result).toMatchObject({ ok: true, displayName: 'Ana' })
    expect(JSON.stringify(result)).not.toContain('tok-secreto')
    expect(readJiraConfig(dir)?.projectKeys).toEqual(['GRAV'])
    expect(readJiraCredentials('https://x.atlassian.net')).toEqual({
      site: 'https://x.atlassian.net',
      email: 'a@x.com',
      apiToken: 'tok-secreto',
    })
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
  it('sin jira.json: array vacío, no llama a la red', async () => {
    const dir = tmp('gravity-jira-proj-')
    expect(await searchJiraQuick(dir, 'algo')).toEqual([])
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
    expect(await searchJiraQuick(dir, 'algo')).toEqual([])
    expect(jiraSearch).not.toHaveBeenCalled()
  })

  it('con credenciales: construye el JQL de clave exacta y delega en jiraSearch', async () => {
    const dir = tmp('gravity-jira-proj-')
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' })
    const issues = [{ key: 'GRAV-1', summary: 's', status: 'Open', issueType: 'Bug', assignee: null }]
    jiraSearch.mockResolvedValue(issues)

    const out = await searchJiraQuick(dir, 'grav-1')

    expect(out).toBe(issues)
    expect(jiraSearch).toHaveBeenCalledWith(
      { site: 'https://x.atlassian.net', email: 'a@x.com', apiToken: 'tok' },
      'key = GRAV-1',
      8,
    )
  })

  it('jiraSearch rechaza: array vacío, no propaga el rechazo', async () => {
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

    expect(await searchJiraQuick(dir, 'algo')).toEqual([])
  })
})
