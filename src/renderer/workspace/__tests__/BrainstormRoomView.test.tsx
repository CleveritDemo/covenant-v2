/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
      if (key === 'tabs.brainstormHumanLabel') return 'You'
      if (key === 'tabs.brainstormHumanPlaceholder') return 'Add a direction…'
      if (key === 'tabs.brainstormHumanSend') return 'Send'
      if (key === 'tabs.brainstormUnknownParticipant') {
        return `Unknown participant (${opts?.id})`
      }
      if (key === 'tabs.brainstormOrphanParticipants') {
        return `Saved participants missing from the catalog (skipped): ${opts?.ids}`
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
      injectBrainstormHumanMessage: vi.fn(),
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

  it('envía interrupción humana y pinta burbuja distinta', () => {
    const inject = vi.fn()
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn(() => () => {}),
        stopBrainstorm: vi.fn(),
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: inject,
      },
    })

    render(
      <BrainstormRoomView
        open
        room={room}
        cwd="/tmp/project"
        agentNamesById={{ atlas: 'Atlas', forge: 'Forge' }}
        onClose={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Add a direction…')
    fireEvent.change(input, { target: { value: 'Focus on the composer first.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(inject).toHaveBeenCalledWith('room-1', 'Focus on the composer first.')
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Focus on the composer first.')).toBeTruthy()
    expect(document.querySelector('.brainstorm-room-view__bubble--human')).toBeTruthy()
    expect(document.querySelector('.brainstorm-room-view__row--human')).toBeTruthy()
  })

  it('renderiza humano como texto plano y agentes con Markdown', () => {
    const withHuman: BrainstormRoom = {
      ...room,
      messages: [
        {
          agentId: 'atlas',
          agentName: 'Atlas',
          round: 0,
          text: '**agente**',
        },
        {
          agentId: 'human',
          agentName: 'You',
          round: 0,
          role: 'human',
          text: '**hola**\n```js\nconst x = 1\n```',
        },
      ],
    }

    render(
      <BrainstormRoomView
        open
        room={withHuman}
        cwd="/tmp/project"
        agentNamesById={{ atlas: 'Atlas', forge: 'Forge' }}
        onClose={vi.fn()}
      />,
    )

    const plain = document.querySelector('.brainstorm-room-view__plain')
    expect(plain).not.toBeNull()
    expect(plain?.textContent).toBe('**hola**\n```js\nconst x = 1\n```')
    expect(document.querySelector('.brainstorm-room-view__bubble--human strong')).toBeNull()
    expect(document.querySelector('.brainstorm-room-view__bubble--human .ai-code-block')).toBeNull()
    expect(document.querySelector('.brainstorm-room-view__bubble:not(.brainstorm-room-view__bubble--human) strong')?.textContent).toBe('agente')
  })

  it('muestra el composer cuando la sala está pausada', () => {
    render(
      <BrainstormRoomView
        open
        room={{ ...room, status: 'paused' }}
        cwd="/tmp/project"
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText('Add a direction…')).toBeTruthy()
  })

  it('oculta el composer tras status done por evento live', () => {
    let emit: ((event: { type: string; status?: string }) => void) | null = null
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn((_id: string, cb: (event: { type: string; status?: string }) => void) => {
          emit = cb
          return () => {}
        }),
        stopBrainstorm: vi.fn(),
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })

    const { rerender } = render(
      <BrainstormRoomView
        open
        room={room}
        cwd="/tmp/project"
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText('Add a direction…')).toBeTruthy()
    emit?.({ type: 'status', status: 'done' })
    rerender(
      <BrainstormRoomView
        open
        room={room}
        cwd="/tmp/project"
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByPlaceholderText('Add a direction…')).toBeNull()
  })

  it('muestra nombre de catálogo y no trata un id huérfano como participante válido', () => {
    const orphanRoom: BrainstormRoom = {
      ...room,
      participantAgentIds: ['frontend', 'qa', 'david'],
      messages: [
        {
          agentId: 'david',
          agentName: 'David',
          round: 0,
          text: 'From the real agent.',
        },
        {
          agentId: 'frontend',
          agentName: 'frontend',
          round: 0,
          text: 'Stale technical id message.',
        },
      ],
    }

    render(
      <BrainstormRoomView
        open
        room={orphanRoom}
        cwd="/tmp/project"
        agents={[
          { id: 'david', name: 'David' },
          { id: 'qa', name: 'QA' },
        ]}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('David · round 1')).toBeTruthy()
    expect(screen.getByText('Unknown participant (frontend) · round 1')).toBeTruthy()
    expect(screen.getByText(
      'Saved participants missing from the catalog (skipped): frontend',
    )).toBeTruthy()
    expect(screen.queryByText(/^frontend · round/)).toBeNull()
  })
})
