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

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({ configured: false, site: '', projectKeys: [], connected: false })
  jiraConnect.mockReset().mockResolvedValue({ ok: true, displayName: 'Rodrigo' })
  ;(window as unknown as { api: unknown }).api = { jiraStatus, jiraConnect }
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
})
