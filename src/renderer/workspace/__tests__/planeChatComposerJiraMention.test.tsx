/**
 * @vitest-environment jsdom
 *
 * Regresión de la Tarea 10, ronda de arreglos 1: una mención de Jira debe
 * (a) reemplazar el token escrito por la clave canónica del issue, y
 * (b) terminar realmente en `contextIds` del turno enviado — no solo en un
 * chip que "parece" adjunto. Sin esto, elegir un issue "funciona" en la UI
 * y no entrega nada (el bug de la Tarea 9, otra vez).
 */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PlaneChatComposer } from '../PlaneChatComposer'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../pushToTalkSpeech', () => ({
  usePushToTalkSpeech: () => ({
    listening: false,
    interim: '',
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
  classifyDictationError: () => 'unsupported',
}))

const jiraStatus = vi.fn()
const jiraSearch = vi.fn()
const materializeTabContext = vi.fn()

const issue = {
  key: 'GRAV-412',
  summary: 'Loop chain colgada',
  status: 'In Progress',
  issueType: 'Bug',
  assignee: 'Rodrigo',
}

const agents = [{ paneId: 'a', title: 'Tech Lead', busy: false }]

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({
    configured: true,
    site: 'acme.atlassian.net',
    projectKeys: ['GRAV'],
    connected: true,
  })
  jiraSearch.mockReset().mockResolvedValue([issue])
  materializeTabContext.mockReset().mockResolvedValue({ ok: true, content: '' })
  ;(window as unknown as { api: unknown }).api = { jiraStatus, jiraSearch, materializeTabContext }
})

afterEach(cleanup)

describe('PlaneChatComposer — mención de Jira', () => {
  it('reemplaza el token por la clave canónica y adjunta el id real al turno enviado', async () => {
    const onSend = vi.fn()
    const { container } = render(
      <PlaneChatComposer
        agents={agents}
        contexts={[]}
        selectedAgentId="a"
        placeholder="msg"
        emptyAgentsHint="empty"
        sendLabel="send"
        cwd="/repo"
        onSelectAgent={vi.fn()}
        onStop={vi.fn()}
        onSend={onSend}
      />,
    )
    const input = () => container.querySelector('textarea') as HTMLTextAreaElement

    // Espera a que `jiraStatus` resuelva `projectKeys` antes de teclear —
    // si no, `mentionRangeAt` no reconoce `GRAV-` como proyecto propio.
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))
    // El picker ignora el teclado si el foco real no está en el textarea
    // (ver JiraMentionPicker.tsx) — igual que en el uso real.
    input().focus()

    const typed = 'arregla GRAV-4'
    fireEvent.change(input(), { target: { value: typed, selectionStart: typed.length } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'GRAV-4'))
    await screen.findByText('Loop chain colgada')

    fireEvent.keyDown(window, { key: 'Enter' })

    // El token truncado desaparece; la clave completa queda en el borrador.
    await waitFor(() => expect(input().value).toBe('arregla GRAV-412 '))
    await waitFor(() => expect(materializeTabContext).toHaveBeenCalledTimes(1))
    const materializedContext = materializeTabContext.mock.calls[0][0].context
    expect(materializedContext.issueKey).toBe('GRAV-412')
    // Deja correr el microtask del `.then()` que mete el id en `pendingContextIds`
    // antes de enviar — si no, el snapshot que lee `submit()` podría ganarle.
    await act(async () => { await Promise.resolve() })

    // Enviar: el id del contexto recién materializado va en el turno, no se
    // pierde aunque `contexts` (el pool) todavía no lo conozca.
    await act(async () => {
      fireEvent.keyDown(input(), { key: 'Enter' })
    })
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    const [, text, , contextIds] = onSend.mock.calls[0]
    expect(text).toBe('arregla GRAV-412')
    expect(contextIds).toEqual([materializedContext.id])
  })
})
