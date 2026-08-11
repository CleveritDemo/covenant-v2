/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { BrainstormRoom, BrainstormStatus } from '@shared/brainstormRoom'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? <div>{children}<div>{footer}</div></div> : null),
}))

vi.mock('../BrainstormBriefFields', () => ({
  BrainstormBriefFields: () => <div data-testid="brief" />,
}))

import { BrainstormEditRoomModal } from '../BrainstormEditRoomModal'

function agent(id: string): ProjectAgentDefinition {
  return { id, name: id, provider: 'claude', permissionMode: 'plan' }
}

function room(status: BrainstormStatus): BrainstormRoom {
  return {
    id: 'sala',
    topic: 'Refinar el backlog',
    participantAgentIds: ['a', 'b'],
    maxRounds: 3,
    status,
    round: 0,
    cursor: 0,
    messages: [],
  }
}

describe('BrainstormEditRoomModal participants', () => {
  const saveBrainstorm = vi.fn()
  const agents = [agent('a'), agent('b'), agent('c')]

  beforeEach(() => {
    saveBrainstorm.mockReset()
    saveBrainstorm.mockImplementation((_cwd: string, next: BrainstormRoom) => (
      Promise.resolve({ ok: true, room: next })
    ))
    ;(window as unknown as { api: Record<string, unknown> }).api = { saveBrainstorm }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('reinvites on an idle room and saves the new order', async () => {
    render(
      <BrainstormEditRoomModal
        open
        cwd="/tmp/project"
        room={room('idle')}
        agents={agents}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    )

    fireEvent.click(screen.getByText('c'))
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(saveBrainstorm).toHaveBeenCalledTimes(1)
    })
    expect(saveBrainstorm.mock.calls[0][1].participantAgentIds).toEqual(['a', 'b', 'c'])
  })

  it('hides the grid once the room has run and keeps its participants', async () => {
    render(
      <BrainstormEditRoomModal
        open
        cwd="/tmp/project"
        room={room('paused')}
        agents={agents}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    )

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(saveBrainstorm).toHaveBeenCalledTimes(1)
    })
    expect(saveBrainstorm.mock.calls[0][1].participantAgentIds).toEqual(['a', 'b'])
  })

  it('will not save an idle room left with a single participant', () => {
    render(
      <BrainstormEditRoomModal
        open
        cwd="/tmp/project"
        room={room('idle')}
        agents={agents}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    )

    fireEvent.click(screen.getByText('b'))
    expect(
      (screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
