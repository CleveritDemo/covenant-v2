/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import { BrainstormRoomView } from '../BrainstormRoomView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'tabs.brainstormSpeakerLabel') {
        return `${opts?.name} · round ${opts?.round}`
      }
      if (key === 'tabs.brainstormSpeakerWriting') {
        return `${opts?.name} · writing…`
      }
      if (key === 'tabs.brainstormRoundSeparator') {
        return `Round ${opts?.round}`
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

describe('BrainstormRoomView minimizada', () => {
  it('clic en scrim minimiza vía onClose y no detiene el runner', () => {
    const stopBrainstorm = vi.fn()
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn(() => () => {}),
        stopBrainstorm,
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })
    const onClose = vi.fn()

    render(
      <BrainstormRoomView open room={room} cwd="/tmp/project" onClose={onClose} />,
    )
    const scrim = document.querySelector('.terminal-modal-scrim')
    expect(scrim).not.toBeNull()
    expect(scrim?.getAttribute('data-close-on-backdrop')).toBe('true')
    // jsdom/createEvent no fija button en PointerEvent; TerminalModal exige button === 0.
    const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    scrim!.dispatchEvent(down)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(stopBrainstorm).not.toHaveBeenCalled()
  })

  it('cerrar no detiene el runner y sigue acumulando turnos oculta', () => {
    const bus: { emit: ((event: Record<string, unknown>) => void) | null } = { emit: null }
    const stopBrainstorm = vi.fn()
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn((_id: string, cb: (event: Record<string, unknown>) => void) => {
          bus.emit = cb
          return () => {}
        }),
        stopBrainstorm,
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })
    const onClose = vi.fn()
    const onLive = vi.fn()

    const { rerender } = render(
      <BrainstormRoomView open room={room} cwd="/tmp/project" onClose={onClose} onLive={onLive} />,
    )
    fireEvent.click(screen.getByText('tabs.brainstormClose'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(stopBrainstorm).not.toHaveBeenCalled()

    // Minimizada: sigue suscrita y publicando quién habla.
    rerender(
      <BrainstormRoomView open={false} room={room} cwd="/tmp/project" onClose={onClose} onLive={onLive} />,
    )
    const before = onLive.mock.calls.length
    bus.emit?.({ type: 'speaker_start', agentId: 'forge', round: 1 })
    rerender(
      <BrainstormRoomView open={false} room={room} cwd="/tmp/project" onClose={onClose} onLive={onLive} />,
    )
    expect(onLive.mock.calls.length).toBeGreaterThan(before)
    expect(onLive.mock.calls.at(-1)?.[0]).toMatchObject({
      roomId: 'room-1',
      status: 'running',
      speakingAgentId: 'forge',
      round: 2,
    })
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
    // El nombre sale en la entrada y en el panel de asientos.
    expect(screen.getAllByText('Atlas').length).toBeGreaterThan(0)
    expect(screen.getByText('Round 1')).toBeTruthy()
    expect(screen.getByText('First take from Atlas.')).toBeTruthy()
    expect(document.querySelectorAll('.chat-bubble').length).toBe(2)
    expect(document.querySelector('.chat-bubble--solid')).toBeNull()
    expect(document.querySelector('.brainstorm-room-view__message')).toBeNull()
    // Acta en una columna: sin lados, un carril de color por hablante.
    const rows = document.querySelectorAll('.brainstorm-room-view__row')
    expect(rows.length).toBe(2)
    expect(document.querySelectorAll('.brainstorm-room-view__lane').length).toBe(2)
    expect(rows[0].getAttribute('style')).toContain('--brainstorm-speaker')
    expect(document.querySelector('.brainstorm-room-view__row--start')).toBeNull()
    expect(document.querySelector('.brainstorm-room-view__row--end')).toBeNull()
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

    // Sin destino elegido: va a la sala (targetAgentId undefined).
    expect(inject).toHaveBeenCalledWith('room-1', 'Focus on the composer first.', undefined)
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Focus on the composer first.')).toBeTruthy()
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
    expect(document.querySelector('.chat-bubble--user strong')).toBeNull()
    expect(document.querySelector('.chat-bubble--user .ai-code-block')).toBeNull()
    expect(document.querySelector('.chat-bubble--assistant strong')?.textContent).toBe('agente')
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

    expect(screen.getAllByText('David').length).toBeGreaterThan(0)
    expect(screen.getByText('Unknown participant (frontend)')).toBeTruthy()
    expect(screen.getByText(
      'Saved participants missing from the catalog (skipped): frontend',
    )).toBeTruthy()
    expect(screen.queryByText(/^frontend$/)).toBeNull()
  })
})

describe('BrainstormRoomView — el turno concedido antes del primer token', () => {
  /** Monta la sala y devuelve el emisor de eventos de main. */
  function mountWithBus(roomInput: BrainstormRoom): {
    emit: (event: Record<string, unknown>) => void
  } {
    const bus: { emit: ((event: Record<string, unknown>) => void) | null } = { emit: null }
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn((_id: string, cb: (event: Record<string, unknown>) => void) => {
          bus.emit = cb
          return () => {}
        }),
        stopBrainstorm: vi.fn(),
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })
    render(
      <BrainstormRoomView
        open
        room={roomInput}
        cwd="/tmp/project"
        agents={[{ id: 'atlas', name: 'Atlas' }, { id: 'forge', name: 'Forge' }]}
        onClose={vi.fn()}
      />,
    )
    return { emit: event => { act(() => { bus.emit?.(event) }) } }
  }

  const emptyRoom: BrainstormRoom = { ...room, messages: [] }

  it('sin turno concedido dice que está preparando la sala', () => {
    mountWithBus(emptyRoom)
    expect(screen.getByText('tabs.brainstormRoomWarmup')).toBeTruthy()
  })

  it('speaker_start ya pinta al orador, sin esperar el primer delta', () => {
    const { emit } = mountWithBus(emptyRoom)
    emit({ type: 'speaker_start', agentId: 'atlas', round: 0 })
    // El hueco de warmup desaparece y aparece la fila viva del orador.
    expect(screen.queryByText('tabs.brainstormRoomWarmup')).toBeNull()
    expect(screen.getByText('tabs.brainstormSpeakerThinking')).toBeTruthy()
    expect(document.querySelector('.brainstorm-room-view__row--live')).not.toBeNull()
  })

  it('al llegar el primer delta pasa de «preparando» a «escribiendo»', () => {
    const { emit } = mountWithBus(emptyRoom)
    emit({ type: 'speaker_start', agentId: 'atlas', round: 0 })
    emit({ type: 'speaker_delta', agentId: 'atlas', round: 0, text: 'Hola' })
    expect(screen.queryByText('tabs.brainstormSpeakerThinking')).toBeNull()
    expect(screen.getByText('Atlas · writing…')).toBeTruthy()
    expect(screen.getByText('Hola')).toBeTruthy()
  })

  it('speaker_final cierra la fila viva y no deja el warmup de vuelta', () => {
    const { emit } = mountWithBus(emptyRoom)
    emit({ type: 'speaker_start', agentId: 'atlas', round: 0 })
    emit({ type: 'speaker_delta', agentId: 'atlas', round: 0, text: 'Hola' })
    emit({
      type: 'speaker_final', agentId: 'atlas', agentName: 'Atlas', round: 0, text: 'Hola',
    })
    expect(document.querySelector('.brainstorm-room-view__row--live')).toBeNull()
    expect(screen.queryByText('tabs.brainstormRoomWarmup')).toBeNull()
  })
})

describe('BrainstormRoomView — salir de una sala terminada', () => {
  function mount(status: BrainstormRoom['status'], onFinish = vi.fn()) {
    const onClose = vi.fn()
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn(() => () => {}),
        stopBrainstorm: vi.fn(),
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })
    render(
      <BrainstormRoomView
        open
        room={{ ...room, status }}
        cwd="/tmp/project"
        onClose={onClose}
        onFinish={onFinish}
      />,
    )
    return { onClose, onFinish }
  }

  it('terminada ofrece cerrar la sala, que la suelta del plano', () => {
    const { onFinish, onClose } = mount('done')
    fireEvent.click(screen.getByText('tabs.brainstormFinish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('detenida también deja salir', () => {
    const { onFinish } = mount('stopped')
    fireEvent.click(screen.getByText('tabs.brainstormFinish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('viva no ofrece cerrar: minimizar es lo único que no la mata', () => {
    mount('running')
    expect(screen.queryByText('tabs.brainstormFinish')).toBeNull()
    expect(screen.getByText('tabs.brainstormClose')).toBeTruthy()
  })

  it('el traffic light rojo suelta la sala terminada en vez de minimizarla', () => {
    const { onFinish, onClose } = mount('done')
    const scrim = document.querySelector('.terminal-modal-scrim')
    scrim!.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
    )
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('viva, el scrim sigue minimizando y no suelta nada', () => {
    const { onFinish, onClose } = mount('running')
    const scrim = document.querySelector('.terminal-modal-scrim')
    scrim!.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()
  })
})

describe('BrainstormRoomView — un solo primario en el pie', () => {
  function footerPrimaries(status: BrainstormRoom['status']): string[] {
    Object.assign(window, {
      api: {
        onBrainstormEvent: vi.fn(() => () => {}),
        stopBrainstorm: vi.fn(),
        pauseBrainstorm: vi.fn(),
        startBrainstorm: vi.fn(),
        injectBrainstormHumanMessage: vi.fn(),
      },
    })
    render(
      <BrainstormRoomView
        open
        room={{ ...room, status }}
        cwd="/tmp/project"
        agents={[{ id: 'atlas', name: 'Atlas' }, { id: 'forge', name: 'Forge' }]}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    )
    return Array.from(
      document.querySelectorAll('.brainstorm-room-view__footer .btn--primary'),
    ).map(node => node.textContent?.trim() ?? '')
  }

  it('terminada: manda cerrar la sala, no alargarla', () => {
    expect(footerPrimaries('done')).toEqual(['tabs.brainstormFinish'])
  })

  it('detenida a mano: manda reanudar, y cerrar baja a secundario', () => {
    expect(footerPrimaries('stopped')).toEqual(['tabs.brainstormResume'])
  })

  it('en pausa: manda reanudar', () => {
    expect(footerPrimaries('paused')).toEqual(['tabs.brainstormResume'])
  })

  it('corriendo: ningún primario compite con Detener', () => {
    expect(footerPrimaries('running')).toEqual([])
  })
})
