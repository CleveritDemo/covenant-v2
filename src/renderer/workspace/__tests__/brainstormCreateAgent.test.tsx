/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { BrainstormStartModal } from '../BrainstormStartModal'

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const agents = [
  agent('rodrigo', 'Product Owner'),
  agent('ana', 'QA'),
]

beforeEach(() => {
  cleanup()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startBrainstorm: vi.fn(),
    discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
  }
})

describe('BrainstormStartModal — CTA crear agente', () => {
  it('con catálogo vacío el CTA aparece y llama onCreateAgent', () => {
    const onCreateAgent = vi.fn()
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[]}
        onClose={() => {}}
        onStarted={() => {}}
        onCreateAgent={onCreateAgent}
      />,
    )
    expect(screen.getByText('tabs.brainstormEmptyCatalog')).toBeTruthy()
    fireEvent.click(screen.getByText('tabs.brainstormCreateAgent'))
    expect(onCreateAgent).toHaveBeenCalledTimes(1)
  })

  it('con catálogo el CTA va al final de la lista y llama onCreateAgent', () => {
    const onCreateAgent = vi.fn()
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={agents}
        onClose={() => {}}
        onStarted={() => {}}
        onCreateAgent={onCreateAgent}
      />,
    )
    const right = document.querySelector('.brainstorm-overlay__col--right') as HTMLElement
    const seats = right.querySelectorAll('.brainstorm-seat--invite')
    const create = right.querySelector('.brainstorm-invite__create')
    expect(seats).toHaveLength(agents.length)
    expect(create).not.toBeNull()
    expect(right.lastElementChild).toBe(create)
    fireEvent.click(screen.getByText('tabs.brainstormCreateAgent'))
    expect(onCreateAgent).toHaveBeenCalledTimes(1)
  })
})
