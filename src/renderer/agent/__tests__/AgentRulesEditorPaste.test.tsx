/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (
      vars ? `${key}:${Object.values(vars).join(',')}` : key
    ),
  }),
}))

import { AgentRulesEditor } from '../AgentRulesEditor'

afterEach(cleanup)

function pasteOn(input: HTMLInputElement, text: string): Event {
  const event = createEvent.paste(input, {
    clipboardData: { getData: () => text },
  })
  fireEvent(input, event)
  return event
}

describe('AgentRulesEditor paste', () => {
  it('un pegado de 3 líneas sobre el primer campo crea una regla por línea', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <AgentRulesEditor
        rules={['']}
        rulesEnabled={[true]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    )
    const input = screen.getByLabelText('agentPane.rulesItemLabel:1') as HTMLInputElement
    const event = pasteOn(input, 'alpha\nbeta\ngamma')
    expect(event.defaultPrevented).toBe(true)
    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta', 'gamma'], [true, true, true])
    expect(onCommit).toHaveBeenCalled()
  })

  it('una sola línea deja el pegado nativo', () => {
    const onChange = vi.fn()
    render(
      <AgentRulesEditor
        rules={['']}
        rulesEnabled={[true]}
        onChange={onChange}
      />,
    )
    const input = screen.getByLabelText('agentPane.rulesItemLabel:1') as HTMLInputElement
    const event = pasteOn(input, 'solo una')
    expect(event.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('muestra el aviso de tope y lo limpia al añadir o borrar', () => {
    const onChange = vi.fn()
    const rules = Array.from({ length: 18 }, (_, i) => `r${i}`)
    const { rerender } = render(
      <AgentRulesEditor
        rules={rules}
        rulesEnabled={rules.map(() => true)}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('agentPane.rulesPasteHint')).toBeTruthy()
    const input = screen.getByLabelText('agentPane.rulesItemLabel:1') as HTMLInputElement
    pasteOn(input, 'a\nb\nc\nd\ne')
    expect(screen.getByText('agentPane.rulesPasteTruncated:2,20')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /agentPane.rulesAdd/ }))
    expect(screen.queryByText('agentPane.rulesPasteTruncated:2,20')).toBeNull()

    rerender(
      <AgentRulesEditor
        rules={rules}
        rulesEnabled={rules.map(() => true)}
        onChange={onChange}
      />,
    )
    pasteOn(screen.getByLabelText('agentPane.rulesItemLabel:1') as HTMLInputElement, 'a\nb\nc\nd\ne')
    expect(screen.getByText('agentPane.rulesPasteTruncated:2,20')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'agentPane.rulesRemove' })[0])
    expect(screen.queryByText('agentPane.rulesPasteTruncated:2,20')).toBeNull()
  })
})
