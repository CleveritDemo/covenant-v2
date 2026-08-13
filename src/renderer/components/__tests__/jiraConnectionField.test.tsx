/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraConnectionField } from '../JiraConnectionField'

// El `t()` real necesita una instancia de i18next inicializada (no la hay en
// jsdom) e ignora la interpolación sin ella; los tests vecinos (p. ej.
// `settingsNav.test.tsx`) mockean `useT` para que devuelva la clave tal cual
// y sustituya `{{param}}` a mano.
vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const jiraStatus = vi.fn()
const jiraConnect = vi.fn()
const jiraDisconnect = vi.fn()

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({
    configured: false,
    site: '',
    email: '',
    projectKeys: [],
    connected: false,
  })
  jiraConnect.mockReset().mockResolvedValue({ ok: true, displayName: 'Rodrigo' })
  jiraDisconnect.mockReset().mockResolvedValue({ ok: true })
  ;(window as unknown as { api: unknown }).api = { jiraStatus, jiraConnect, jiraDisconnect }
})

// Vitest no inyecta `afterEach` como global (`test.globals` está apagado), así
// que el auto-cleanup de @testing-library/react no se activa por sí solo.
afterEach(cleanup)

// `SettingsField` mete el `hint` dentro del mismo <label> que envuelve el
// input (por diseño: el hint es parte de la descripción accesible del campo),
// así que el nombre accesible real es «etiqueta + hint» para site/token/
// projectKeys. `exact: false` empareja por subcadena en vez de igualdad
// estricta — sigue siendo la etiqueta real la que ancla la búsqueda.
describe('JiraConnectionField', () => {
  it('sin conectar pide sitio, email y token', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))
    expect(screen.getByLabelText('jira.siteLabel', { exact: false })).toBeTruthy()
    expect(screen.getByLabelText('jira.emailLabel')).toBeTruthy()
    expect(screen.getByLabelText('jira.tokenLabel', { exact: false })).toBeTruthy()
  })

  it('conectar manda los cuatro campos y muestra a quién autenticó', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('jira.siteLabel', { exact: false }), { target: { value: 'https://x.atlassian.net' } })
    fireEvent.change(screen.getByLabelText('jira.emailLabel'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('jira.tokenLabel', { exact: false }), { target: { value: 'tok' } })
    fireEvent.change(screen.getByLabelText('jira.projectKeysLabel', { exact: false }), { target: { value: 'GRAV, COV' } })
    fireEvent.click(screen.getByText('jira.connectAction'))

    await waitFor(() => expect(jiraConnect).toHaveBeenCalledWith('/repo', {
      site: 'https://x.atlassian.net',
      email: 'a@b.c',
      apiToken: 'tok',
      projectKeys: ['GRAV', 'COV'],
    }))
    await screen.findByText(/Rodrigo/)
  })

  it('un fallo de conexión se muestra y no se traga', async () => {
    jiraConnect.mockResolvedValue({ ok: false, error: 'Jira 401' })
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('jira.siteLabel', { exact: false }), { target: { value: 'https://x.atlassian.net' } })
    fireEvent.click(screen.getByText('jira.connectAction'))
    await screen.findByText(/401/)
  })

  it('el input del token no expone el valor en claro', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    expect(screen.getByLabelText('jira.tokenLabel', { exact: false }).getAttribute('type')).toBe('password')
  })

  it('con credenciales ya guardadas, al abrir Ajustes se ve conectado y con el email puesto', async () => {
    // El caso que faltaba: el componente leía `status.connected` y lo tiraba,
    // así que una conexión que funcionaba se pintaba como «sin conectar» y
    // empujaba a reconectar con el email vacío → 401 encima de algo sano.
    jiraStatus.mockResolvedValue({
      configured: true,
      site: 'https://x.atlassian.net',
      email: 'a@b.c',
      projectKeys: ['GRAV'],
      connected: true,
    })
    render(<JiraConnectionField cwd="/repo" />)

    await screen.findByText(/jira\.connectedToSite/)
    expect(screen.queryByText('jira.disconnectedHint')).toBeNull()
    expect((screen.getByLabelText('jira.emailLabel') as HTMLInputElement).value).toBe('a@b.c')
    expect(screen.getByText('jira.disconnectAction')).toBeTruthy()
  })

  it('desconectar limpia el estado conectado', async () => {
    jiraStatus.mockResolvedValue({
      configured: true,
      site: 'https://x.atlassian.net',
      email: 'a@b.c',
      projectKeys: [],
      connected: true,
    })
    render(<JiraConnectionField cwd="/repo" />)
    fireEvent.click(await screen.findByText('jira.disconnectAction'))

    await waitFor(() => expect(jiraDisconnect).toHaveBeenCalledWith('/repo'))
    await screen.findByText('jira.disconnectedHint')
  })

  it('sin proyecto abierto: campos deshabilitados, Conectar apagado y aviso', async () => {
    // `settingsCwd` es '' en una pestaña de terminal. Dejar conectar ahí
    // escribe `jira.json` en el cwd del proceso (el repo de Gravity en dev,
    // `/` empaquetado desde Finder).
    render(<JiraConnectionField cwd="" />)

    await screen.findAllByText('jira.noProjectHint')
    expect(jiraStatus).not.toHaveBeenCalled()
    expect((screen.getByText('jira.connectAction') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('jira.siteLabel', { exact: false }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('jira.tokenLabel', { exact: false }) as HTMLInputElement).disabled).toBe(true)
  })

  it('avisa cuando el connect añadió la regla al .gitignore', async () => {
    jiraConnect.mockResolvedValue({ ok: true, displayName: 'Rodrigo', gitignore: 'appended' })
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('jira.siteLabel', { exact: false }), { target: { value: 'https://x.atlassian.net' } })
    fireEvent.click(screen.getByText('jira.connectAction'))

    await screen.findByText('jira.gitignoreAppended')
  })

  it('avisa cuando la clave de proyecto es en realidad el nombre del proyecto', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    // `CDLC-TRANSFORMATION` es el NOMBRE. Una clave de Jira no lleva guion, y
    // con esto el `project in (…)` que arma el buscador es inválido: búsquedas
    // y menciones devuelven vacío sin decir por qué.
    fireEvent.change(screen.getByLabelText('jira.projectKeysLabel', { exact: false }), {
      target: { value: 'CDLC-TRANSFORMATION' },
    })
    expect(screen.getByText(/jira.projectKeyWarning/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('jira.projectKeysLabel', { exact: false }), {
      target: { value: 'CDLC, GRAV' },
    })
    expect(screen.queryByText(/jira.projectKeyWarning/)).toBeNull()
  })
})
