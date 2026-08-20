/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { BrainstormHumanComposer } from '../BrainstormHumanComposer'
import { BrainstormRoomsView } from '../BrainstormRoomsView'
import { BrainstormStartModal } from '../BrainstormStartModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/ConfirmTerminalModal', () => ({
  ConfirmTerminalModal: () => null,
}))

vi.mock('../BrainstormEditRoomModal', () => ({
  BrainstormEditRoomModal: () => null,
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
    listBrainstorms: vi.fn().mockResolvedValue([]),
    exportBrainstormMarkdown: vi.fn(),
    materializeTabContext: vi.fn(),
    deleteBrainstorm: vi.fn(),
    pruneBrainstorms: vi.fn(),
    openFolder: vi.fn(),
    saveBrainstorm: vi.fn(),
  }
})

describe('anclas de onboarding Planificar', () => {
  it('setup: goal, participantes, inicio y pestañas llevan data-onboarding', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={agents}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )

    expect(document.querySelector('.brainstorm-start__field')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-goal')
    expect(document.querySelector('.brainstorm-overlay__col--right')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-participants')
    expect(document.querySelector('[data-onboarding="brainstorm-start"]')).toBeTruthy()
    expect(document.querySelector('.brainstorm-overlay__tabs')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-module-tabs')

    const participantsAnchor = document.querySelector('[data-onboarding="brainstorm-participants"]')
    expect(participantsAnchor).toBeTruthy()
    expect(participantsAnchor?.querySelectorAll('.brainstorm-seat--invite[role="button"]').length)
      .toBeGreaterThan(0)
  })

  it('rooms: pestañas y lista de salas llevan data-onboarding', async () => {
    render(
      <BrainstormRoomsView
        open
        cwd="/repo"
        onClose={() => {}}
        onCreate={() => {}}
        onOpenRoom={() => {}}
      />,
    )

    await waitFor(() => {
      expect(document.querySelector('.brainstorm-overlay__tabs')).toBeTruthy()
    })

    expect(document.querySelector('.brainstorm-overlay__tabs')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-module-tabs')
    expect(document.querySelector('.brainstorm-rooms')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-rooms-list')
  })

  it('sala viva: el composer humano lleva data-onboarding', () => {
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

    expect(document.querySelector('.brainstorm-human-composer')?.getAttribute('data-onboarding'))
      .toBe('brainstorm-human-composer')
  })
})
