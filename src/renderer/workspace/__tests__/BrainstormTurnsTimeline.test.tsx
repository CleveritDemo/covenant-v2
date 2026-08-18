/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BrainstormMessage } from '@shared/brainstormRoom'
import { BrainstormTurnsTimeline } from '../BrainstormTurnsTimeline'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'tabs.brainstormTurnTimelineJump') {
        return `Jump to ${opts?.name}'s turn`
      }
      if (key === 'tabs.brainstormTurnTimelineSpeaking') return 'speaking…'
      return key
    },
  }),
}))

const messages: BrainstormMessage[] = [
  {
    agentId: 'atlas',
    agentName: 'Atlas',
    round: 0,
    text: 'First take from Atlas. Keep the rest out.',
  },
  {
    agentId: 'human',
    agentName: 'Director',
    round: 0,
    role: 'human',
    text: 'Please focus on the API.',
  },
  {
    agentId: 'forge',
    agentName: 'Forge',
    round: 0,
    text: 'Reply from Forge.',
  },
]

afterEach(() => {
  cleanup()
})

describe('BrainstormTurnsTimeline', () => {
  it('omite el mensaje humano, muestra recorte, salta al índice original y deja vacía la ronda sin turnos', () => {
    const onJumpToTurn = vi.fn()
    const { container } = render(
      <BrainstormTurnsTimeline
        maxRounds={2}
        currentRound={0}
        status="running"
        messages={messages}
        speakingName={null}
        onJumpToTurn={onJumpToTurn}
      />,
    )

    expect(screen.queryByText('Director')).toBeNull()
    expect(screen.queryByText('Please focus on the API.')).toBeNull()

    expect(screen.getByText('Atlas')).toBeTruthy()
    expect(screen.getByText('First take from Atlas.')).toBeTruthy()
    expect(screen.getByText('Forge')).toBeTruthy()
    expect(screen.getByText('Reply from Forge.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: "Jump to Atlas's turn" }))
    fireEvent.click(screen.getByRole('button', { name: "Jump to Forge's turn" }))
    expect(onJumpToTurn.mock.calls.map(call => call[0])).toEqual([0, 2])

    const rounds = container.querySelectorAll('.brainstorm-turn-timeline__round')
    expect(rounds).toHaveLength(2)
    expect(rounds[1].querySelectorAll('.brainstorm-turn-timeline__turn')).toHaveLength(0)
  })
})
