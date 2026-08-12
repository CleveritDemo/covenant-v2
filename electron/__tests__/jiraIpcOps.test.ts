import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
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
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const jiraMyself = vi.fn()
const jiraSearch = vi.fn()
vi.mock('../jiraClient', () => ({ jiraMyself, jiraSearch }))

const { jiraStatusFor, connectJira, searchJiraQuick } = await import('../jiraIpcOps')
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

    expect(result).toEqual({ ok: true, displayName: 'Ana' })
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
