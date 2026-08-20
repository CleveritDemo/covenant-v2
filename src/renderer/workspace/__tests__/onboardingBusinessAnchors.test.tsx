/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { BrainstormHumanComposer } from '../BrainstormHumanComposer'
import { BrainstormModuleTabs } from '../BrainstormModuleTabs'
import { BrainstormStartModal } from '../BrainstormStartModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const agents = [
  agent('rodrigo', 'Product Owner'),
  agent('ana', 'QA'),
  agent('nico', 'Dev'),
]

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  cleanup()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startBrainstorm: vi.fn(),
    discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
  }
})

describe('anclas de onboarding Planificar', () => {
  it('pestañas, composer y alta de sala llevan data-onboarding para el coach mark', () => {
    render(
      <BrainstormModuleTabs
        tab="new"
        roomsCount={0}
        onRooms={vi.fn()}
        onNew={vi.fn()}
      />,
    )
    render(
      <BrainstormHumanComposer
        placeholder="tabs.brainstormHumanPlaceholder"
        sendLabel="tabs.brainstormHumanSend"
        roomLabel="tabs.brainstormTargetRoom"
        timingHint="tabs.brainstormHumanTiming"
        cwd="/repo"
        addContextLabel="tabs.brainstormHumanAddContext"
        onSend={vi.fn()}
      />,
    )
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={agents}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )

    expect(document.querySelector('.brainstorm-overlay__tabs')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-module-tabs')
    expect(document.querySelector('.brainstorm-human-composer')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-human-composer')
    expect(document.querySelector('.brainstorm-start__field')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-goal')
    expect(document.querySelector('.brainstorm-overlay__col--right')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-participants')
    expect(document.querySelector('.brainstorm-overlay__col-head')?.getAttribute('data-onboarding'))
      .toBeNull()
    // El coach apunta al token de formato (2º de la frase), no a la frase entera.
    const ceremonyAnchor = document.querySelector('[data-onboarding="brainstorm-ceremony"]')
    const tokens = document.querySelectorAll('.brainstorm-sentence__tok')
    expect(ceremonyAnchor).toBe(tokens[1])
    expect(ceremonyAnchor?.tagName).toBe('BUTTON')
    expect(document.querySelector('.brainstorm-sentence')?.getAttribute('data-onboarding'))
      .toBeNull()
    expect(document.querySelector('[data-onboarding="brainstorm-start"]')).toBeTruthy()
  })
})
