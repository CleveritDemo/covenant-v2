import { describe, expect, it } from 'vitest'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import {
  collectRunningThreadActivities,
  collectRunningThreadIds,
  computeBusyForGate,
  lastUserPromptFromMessages,
  mergePaneReportedRunningThreadIds,
} from '../AgentPane'
import { setLaneActivity, startLane, endLane } from '../paneThreadLanes'

const user: AgentChatEntry = { id: 'u1', role: 'user', content: 'hola' }
const assistant: AgentChatEntry = { id: 'a1', role: 'assistant', content: '' }

describe('collectRunningThreadIds', () => {
  it('reporta un hilo humano promovido a carril de fondo', () => {
    const lanes = startLane(new Map(), {
      threadId: 'human-bg',
      delegationId: '',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    expect(collectRunningThreadIds(lanes, 'human-active', false)).toEqual(['human-bg'])
  })

  it('reporta el hilo activo cuando el pane está busy', () => {
    expect(collectRunningThreadIds(new Map(), 'human-active', true)).toEqual(['human-active'])
  })

  it('deja de reportar el hilo cuando el carril cierra', () => {
    let lanes = startLane(new Map(), {
      threadId: 'human-bg',
      delegationId: '',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    lanes = endLane(lanes, 'human-bg')
    expect(collectRunningThreadIds(lanes, 'human-active', false)).toEqual([])
  })

  it('no duplica el hilo activo si ya está en un carril busy', () => {
    const lanes = startLane(new Map(), {
      threadId: 'human-active',
      delegationId: '',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    expect(collectRunningThreadIds(lanes, 'human-active', true)).toEqual(['human-active'])
  })
})

describe('computeBusyForGate', () => {
  it('is false when only a background thread is running', () => {
    const lanes = startLane(new Map(), {
      threadId: 'human-bg',
      delegationId: '',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    const running = collectRunningThreadIds(lanes, 'human-active', false)
    expect(running).toEqual(['human-bg'])
    expect(computeBusyForGate(false, running, 'human-active')).toBe(false)
    expect(computeBusyForGate(true, running, 'human-active')).toBe(false)
  })

  it('is true when the active thread is running', () => {
    expect(computeBusyForGate(true, ['human-active'], 'human-active')).toBe(true)
    expect(computeBusyForGate(true, [], 'human-active')).toBe(true)
    const lanes = startLane(new Map(), {
      threadId: 'human-active',
      delegationId: '',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    const running = collectRunningThreadIds(lanes, 'human-active', true)
    expect(computeBusyForGate(true, running, 'human-active')).toBe(true)
  })

  it('is false when pane is idle', () => {
    expect(computeBusyForGate(false, ['human-bg'], 'human-active')).toBe(false)
  })
})

describe('lastUserPromptFromMessages', () => {
  it('toma el último mensaje user ignorando assistant', () => {
    const msgs: AgentChatEntry[] = [
      { id: 'u1', role: 'user', content: 'Primera' },
      { id: 'a1', role: 'assistant', content: 'Respuesta larga' },
      { id: 'u2', role: 'user', content: 'Segunda petición' },
    ]
    expect(lastUserPromptFromMessages(msgs)).toBe('Segunda petición')
  })

  it('muestra el objetivo del encargo sin cabecera ni metadatos', () => {
    const brief = [
      '## Delegation brief',
      'from: tech-lead-copy',
      'to: frontend',
      'round: 1/∞',
      '',
      'Añade un flag offline a las guardas de envío',
    ].join('\n')
    const msgs: AgentChatEntry[] = [
      { id: 'u1', role: 'user', content: brief },
    ]
    const result = lastUserPromptFromMessages(msgs)
    expect(result).toBe('Añade un flag offline a las guardas de envío')
    expect(result).not.toContain('##')
    expect(result).not.toContain('from:')
  })

  it('no altera un mensaje humano normal', () => {
    const msgs: AgentChatEntry[] = [
      { id: 'u1', role: 'user', content: 'Revisa los tests del header' },
    ]
    expect(lastUserPromptFromMessages(msgs)).toBe('Revisa los tests del header')
  })
})

describe('collectRunningThreadActivities', () => {
  it('expone la petición del usuario en un carril de fondo', () => {
    const userMsg: AgentChatEntry = {
      id: 'u1',
      role: 'user',
      content: 'Arregla el CSS del header',
    }
    let lanes = startLane(new Map(), {
      threadId: 'human-bg',
      delegationId: '',
      assistantId: 'a1',
      messages: [userMsg, assistant],
    })
    lanes = setLaneActivity(lanes, 'human-bg', 'Editando CSS')
    expect(collectRunningThreadActivities(
      lanes,
      ['human-bg'],
      'human-active',
      [],
    )).toEqual({ 'human-bg': 'Arregla el CSS del header' })
  })

  it('usa la última petición del hilo activo cuando no hay carril', () => {
    const msgs: AgentChatEntry[] = [
      { id: 'u1', role: 'user', content: 'Revisa los tests' },
      { id: 'a1', role: 'assistant', content: 'Leyendo archivos…' },
    ]
    expect(collectRunningThreadActivities(
      new Map(),
      ['human-active'],
      'human-active',
      msgs,
    )).toEqual({ 'human-active': 'Revisa los tests' })
  })

  it('sustituye follow-ups de delegación con etiqueta humana en la mini', () => {
    const msgs: AgentChatEntry[] = [
      { id: 'u1', role: 'user', content: '## Delegation result id: d-740\nstatus: ok' },
      { id: 'a1', role: 'assistant', content: 'Procesando…' },
    ]
    expect(collectRunningThreadActivities(
      new Map(),
      ['human-active'],
      'human-active',
      msgs,
      { delegationResultsLabel: 'Obteniendo resultados…' },
    )).toEqual({ 'human-active': 'Obteniendo resultados…' })
  })

  it('prefiere la petición humana real si hay resultado de delegación más reciente', () => {
    const msgs: AgentChatEntry[] = [
      { id: 'u0', role: 'user', content: 'Arregla el header' },
      { id: 'u1', role: 'user', content: '## Delegation result id: d-740\nstatus: ok' },
    ]
    expect(collectRunningThreadActivities(
      new Map(),
      ['human-active'],
      'human-active',
      msgs,
      { delegationResultsLabel: 'Obteniendo resultados…' },
    )).toEqual({ 'human-active': 'Arregla el header' })
  })
})

describe('mergePaneReportedRunningThreadIds', () => {
  it('une hilos de delegación pendiente con los reportados por el pane', () => {
    const byPane = new Map<string, Set<string>>([
      ['spec-pane', new Set(['deleg-thread'])],
    ])
    mergePaneReportedRunningThreadIds(byPane, {
      'spec-pane': { runningThreadIds: ['human-bg'] },
    })
    expect([...byPane.get('spec-pane')!].sort()).toEqual(['deleg-thread', 'human-bg'])
  })

  it('marca running en entidades del plano cuando el hilo está en el Set', () => {
    const byPane = new Map<string, Set<string>>()
    mergePaneReportedRunningThreadIds(byPane, {
      'agent-pane': { runningThreadIds: ['human-bg'] },
    })
    const threads = [
      { id: 'human-bg', title: 'Fondo' },
      { id: 'idle', title: 'Idle' },
    ]
    const running = threads.map(thread => ({
      ...thread,
      running: byPane.get('agent-pane')?.has(thread.id) ?? false,
    }))
    expect(running.find(thread => thread.id === 'human-bg')?.running).toBe(true)
    expect(running.find(thread => thread.id === 'idle')?.running).toBe(false)
  })
})
