/** @vitest-environment jsdom */
import React, { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useJiraMention } from '../../workspace/useJiraMention'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const jiraSearch = vi.fn()
const jiraStatus = vi.fn()

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({
    configured: true,
    site: 'https://x.atlassian.net',
    email: 'a@x.com',
    projectKeys: ['CT'],
    connected: true,
  })
  jiraSearch.mockReset().mockResolvedValue({
    issues: [{
      key: 'CT-128',
      summary: 'Permissions en rojo',
      status: 'Por hacer',
      issueType: 'Bug',
      assignee: null,
      updated: '2026-08-12T09:40:00.000Z',
    }],
  })
  ;(window as unknown as { api: unknown }).api = { jiraStatus, jiraSearch }
})

afterEach(cleanup)

/**
 * Sonda mínima con la misma forma que el cuadro de commit: un textarea cuyo
 * texto es el mensaje, sin materializar contexto. Montar `GitPanelModal` entero
 * arrastraría `gitStatus`, worktrees y el modal de la app — nada de eso influye
 * en la mención, y el harness sería más frágil que lo que prueba.
 */
const CommitBox: React.FC = () => {
  const [message, setMessage] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const mention = useJiraMention({
    cwd: '/repo',
    value: message,
    onValueChange: setMessage,
    inputRef: ref,
    placement: 'down',
    showEmptyState: true,
  })
  return (
    <div>
      <textarea
        ref={ref}
        aria-label="commit"
        value={message}
        onChange={event => {
          setMessage(event.target.value)
          mention.handleChange(event.target)
        }}
        onSelect={event => mention.handleSelect(event.currentTarget)}
      />
      {mention.picker}
    </div>
  )
}

describe('mención de Jira en el mensaje de commit', () => {
  it('`#` abre el buscador y elegir deja la clave escrita', async () => {
    render(<CommitBox />)
    const box = screen.getByLabelText('commit') as HTMLTextAreaElement
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))

    fireEvent.change(box, { target: { value: '#CT-12' } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'CT-12'))

    const option = await screen.findByRole('option')
    fireEvent.click(option)

    // El token `#CT-12` se sustituye por la clave canónica, listo para seguir
    // escribiendo el mensaje: `CT-128: arregla…`.
    await waitFor(() => expect(box.value).toBe('CT-128 '))
  })

  it('no materializa ningún contexto: un commit solo quiere la clave', async () => {
    const materializeTabContext = vi.fn()
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      jiraStatus,
      jiraSearch,
      materializeTabContext,
    }
    render(<CommitBox />)
    const box = screen.getByLabelText('commit') as HTMLTextAreaElement
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    fireEvent.change(box, { target: { value: '#CT-12' } })
    fireEvent.click(await screen.findByRole('option'))

    await waitFor(() => expect(box.value).toBe('CT-128 '))
    expect(materializeTabContext).not.toHaveBeenCalled()
  })

  it('sin proyecto no hay mención: el panel git puede abrirse sin carpeta', async () => {
    const NoProject: React.FC = () => {
      const [message, setMessage] = useState('')
      const ref = useRef<HTMLTextAreaElement>(null)
      const mention = useJiraMention({
        cwd: '',
        value: message,
        onValueChange: setMessage,
        inputRef: ref,
      })
      return (
        <div>
          <textarea
            ref={ref}
            aria-label="commit"
            value={message}
            onChange={event => {
              setMessage(event.target.value)
              mention.handleChange(event.target)
            }}
          />
          {mention.picker}
        </div>
      )
    }
    render(<NoProject />)
    fireEvent.change(screen.getByLabelText('commit'), { target: { value: '#CT-12' } })
    await waitFor(() => expect(screen.queryByRole('option')).toBeNull())
    expect(jiraStatus).not.toHaveBeenCalled()
    expect(jiraSearch).not.toHaveBeenCalled()
  })
})
