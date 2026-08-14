/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (
      vars ? `${key}:${Object.values(vars).join(',')}` : key
    ),
  }),
}))

import { AgentRulesEditor } from '../AgentRulesEditor'

afterEach(cleanup)

const defaultEnabled = (rules: string[]) => rules.map(() => true)

describe('AgentRulesEditor', () => {
  it('sube una regla sin perder las demás ni los flags', () => {
    const onChange = vi.fn()
    render(
      <AgentRulesEditor
        rules={['a', 'b', 'c']}
        rulesEnabled={[true, false, true]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'agentPane.rulesMoveUp' })[2])
    expect(onChange).toHaveBeenCalledWith(['a', 'c', 'b'], [true, true, false])
  })

  it('la primera no sube y la última no baja', () => {
    render(
      <AgentRulesEditor
        rules={['a', 'b']}
        rulesEnabled={defaultEnabled(['a', 'b'])}
        onChange={() => {}}
      />,
    )
    const up = screen.getAllByRole('button', { name: 'agentPane.rulesMoveUp' })
    const down = screen.getAllByRole('button', { name: 'agentPane.rulesMoveDown' })
    expect(up[0].hasAttribute('disabled')).toBe(true)
    expect(down[1].hasAttribute('disabled')).toBe(true)
  })

  it('la fila de alta lleva el contador contra el máximo', () => {
    render(
      <AgentRulesEditor
        rules={['a']}
        rulesEnabled={[true]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('1/20')).toBeTruthy()
  })

  it('deshabilita una regla sin borrar el texto', () => {
    const onChange = vi.fn()
    render(
      <AgentRulesEditor
        rules={['keep', 'pause']}
        rulesEnabled={[true, true]}
        onChange={onChange}
      />,
    )
    const toggles = screen.getAllByRole('switch', { name: 'agentPane.rulesToggleLabel' })
    fireEvent.click(toggles[1])
    expect(onChange).toHaveBeenCalledWith(['keep', 'pause'], [true, false])
  })
})
