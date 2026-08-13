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
  it('Escape cierra la vista y no detiene el runner', () => {
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
    // Sala sobre el plano, no modal: no hay scrim que cerrar.
    expect(document.querySelector('.brainstorm-overlay')).not.toBeNull()
    expect(document.querySelector('.terminal-modal-scrim')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
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
    fireEvent.click(screen.getByLabelText('tabs.brainstormCloseView'))
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
    // El nombre sale en la entrada y en la tarjeta del asiento.
    expect(screen.getAllByText('Atlas').length).toBeGreaterThan(0)
    expect(screen.getByText('Round 1')).toBeTruthy()
    // La última línea del turno también sale en la tarjeta del asiento: el acta
    // es la que tiene que llevarla entera.
    const thread = document.querySelector('.brainstorm-room-view__messages')
    expect(thread?.textContent).toContain('First take from Atlas.')
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
    // «Hola» sale en el acta y, como cola del turno en curso, en su asiento.
    const live = document.querySelector('.brainstorm-room-view__row--live')
    expect(live?.textContent).toContain('Hola')
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

  it('viva no ofrece cerrar la sala: solo cerrar la vista, que no la mata', () => {
    mount('running')
    expect(screen.queryByText('tabs.brainstormFinish')).toBeNull()
    expect(screen.getByLabelText('tabs.brainstormCloseView')).toBeTruthy()
  })

  it('viva, detener es un botón aparte de cerrar la vista', () => {
    const { onClose, onFinish } = mount('running')
    fireEvent.click(screen.getByLabelText('tabs.brainstormStopRun'))
    expect(window.api.stopBrainstorm).toHaveBeenCalledWith(room.id)
    expect(onClose).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('terminada, cerrar la vista la suelta del plano: su acta queda guardada', () => {
    const { onFinish, onClose } = mount('done')
    fireEvent.click(screen.getByLabelText('tabs.brainstormFinishHint'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('viva, Escape solo cierra la vista', () => {
    const { onFinish, onClose } = mount('running')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()
  })
})

describe('BrainstormRoomView — un primario en el pie, la marcha en el chrome', () => {
  function mountStatus(status: BrainstormRoom['status']): void {
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
  }

  /** Botones de marcha del chrome, por su etiqueta accesible. */
  function chromeControls(): string[] {
    return Array.from(document.querySelectorAll('.brainstorm-overlay__bar button'))
      .map(node => node.getAttribute('aria-label') ?? '')
  }

  function footerPrimaries(): string[] {
    return Array.from(
      document.querySelectorAll('.brainstorm-room-view__footer .btn--primary'),
    ).map(node => node.textContent?.trim() ?? '')
  }

  it('corriendo: pausar y detener arriba, ningún primario abajo', () => {
    mountStatus('running')
    expect(chromeControls()).toContain('tabs.brainstormPause')
    expect(chromeControls()).toContain('tabs.brainstormStopRun')
    expect(chromeControls()).not.toContain('tabs.brainstormResume')
    expect(footerPrimaries()).toEqual([])
  })

  it('en pausa: reanudar sustituye a pausar, sin dos marchas a la vez', () => {
    mountStatus('paused')
    expect(chromeControls()).toContain('tabs.brainstormResume')
    expect(chromeControls()).not.toContain('tabs.brainstormPause')
  })

  it('terminada: el único primario es cerrar la sala, no alargarla', () => {
    mountStatus('done')
    expect(footerPrimaries()).toEqual(['tabs.brainstormFinish'])
  })

  it('detenida a mano: reanudar arriba y cerrar baja a secundario', () => {
    mountStatus('stopped')
    expect(chromeControls()).toContain('tabs.brainstormResume')
    expect(footerPrimaries()).toEqual([])
  })
})

describe('BrainstormRoomView — situarse al final, no viajar hasta él', () => {
  function mountWithScrollSpy(status: BrainstormRoom['status'] = 'running') {
    const scrolls: (ScrollIntoViewOptions | undefined)[] = []
    // `vitest.setup` ya stubea el de HTMLElement: hay que espiar ese mismo.
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
      function scrollIntoView(arg?: boolean | ScrollIntoViewOptions) {
        scrolls.push(typeof arg === 'object' ? arg : undefined)
      },
    )
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
        room={{ ...room, status }}
        cwd="/tmp/project"
        onClose={vi.fn()}
      />,
    )
    return { scrolls, bus }
  }

  it('al abrir no anima: salta el contenedor, sin scrollIntoView', () => {
    // `behavior: 'auto'` delega en el CSS, y el acta pide `scroll-behavior:
    // smooth`; por eso el anclaje inicial no pasa por `scrollIntoView`.
    const { scrolls } = mountWithScrollSpy()
    expect(scrolls.length).toBe(0)
  })

  it('un turno que llega mientras miras sí se desliza', () => {
    const { scrolls, bus } = mountWithScrollSpy()
    const before = scrolls.length
    act(() => {
      bus.emit?.({
        type: 'speaker_final', agentId: 'atlas', agentName: 'Atlas', round: 1, text: 'Nuevo turno.',
      })
    })
    expect(scrolls.length).toBeGreaterThan(before)
    expect(scrolls[scrolls.length - 1]?.behavior).toBe('smooth')
  })
})
