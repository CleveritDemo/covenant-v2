/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import { BrainstormRoomView } from '../BrainstormRoomView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'tabs.brainstormSpeakerLabel') {
        return `${opts?.name} · round ${opts?.round}`
      }
      if (key === 'tabs.brainstormRoundValue') {
        return `${opts?.current} / ${opts?.max}`
      }
      return key
    },
  }),
}))

const room: BrainstormRoom = {
  id: 'room-1',
  topic: 'Ship the chat UI',
  participantAgentIds: ['atlas', 'forge'],
  maxRounds: 3,
  round: 0,
  cursor: 0,
  status: 'running',
  messages: [
    {
      agentId: 'atlas',
      agentName: 'Atlas',
      round: 0,
      text: 'First take from Atlas.',
    },
    {
      agentId: 'forge',
      agentName: 'Forge',
      round: 0,
      text: 'Reply from Forge.',
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  Object.assign(window, {
    api: {
      onBrainstormEvent: vi.fn(() => () => {}),
      stopBrainstorm: vi.fn(),
      pauseBrainstorm: vi.fn(),
      startBrainstorm: vi.fn(),
    },
  })
})

describe('BrainstormRoomView chat bubbles', () => {
  it('renderiza mensajes como burbujas, no cards con borde', () => {
    render(
      <BrainstormRoomView
        open
        room={room}
        cwd="/tmp/project"
        agentNamesById={{ atlas: 'Atlas', forge: 'Forge' }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Ship the chat UI')).toBeTruthy()
    expect(screen.getByText('Atlas · round 1')).toBeTruthy()
    expect(screen.getByText('First take from Atlas.')).toBeTruthy()
    expect(document.querySelectorAll('.brainstorm-room-view__bubble').length).toBe(2)
    expect(document.querySelector('.brainstorm-room-view__message')).toBeNull()
    const rows = document.querySelectorAll('.brainstorm-room-view__row')
    expect(rows[0].className).toContain('brainstorm-room-view__row--start')
    expect(rows[1].className).toContain('brainstorm-room-view__row--end')
  })
})
