/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { AgentDelegateToPolicyEditor } from '../AgentDelegateToPolicyEditor'

afterEach(cleanup)

describe('AgentDelegateToPolicyEditor', () => {
  it('muestra monograma y marca del CLI en la fila de especialista', () => {
    const { container } = render(
      <AgentDelegateToPolicyEditor
        value={{ agentIds: [] }}
        agents={[
          {
            id: 'frontend',
            name: 'Frontend',
            coordination: 'none',
            provider: 'cursor',
            monogram: 'FE',
          },
        ]}
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('Frontend')).toBeTruthy()
    const face = container.querySelector('.agent-face')
    expect(face?.textContent).toContain('FE')
    expect(face?.querySelector('.agent-face__brand svg')).toBeTruthy()
  })
})
