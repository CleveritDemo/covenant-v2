import { describe, expect, it } from 'vitest'
import { decideParentDelegationNotify } from '../agent/parentDelegationNotify'

/**
 * Slice 3: el hold del padre pasa de un boolean por turno a un contador
 * explícito de nested delegation ids en `activeDelegationRef.awaitingNested`.
 * Estos tests describen la traducción desde ese contador hacia
 * decideParentDelegationNotify (lo que AgentPane hace en completeTurn).
 */

function decide(input: {
  held: boolean
  awaitingNested: Set<string>
  canDelegate?: boolean
  aborted?: boolean
}) {
  return decideParentDelegationNotify({
    held: input.held,
    dispatchedNested: input.awaitingNested.size > 0,
    ...(input.canDelegate !== undefined ? { canDelegate: input.canDelegate } : {}),
    ...(input.aborted !== undefined ? { aborted: input.aborted } : {}),
  })
}

describe('parent delegation hold via awaitingNested', () => {
  it('mantiene hold si el orquestador emitió delegaciones anidadas', () => {
    const awaiting = new Set<string>(['nested-1', 'nested-2'])
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: true })).toBe('hold')
  })

  it('notifica al padre cuando no quedan nested por esperar', () => {
    const awaiting = new Set<string>()
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: true })).toBe('notify')
  })

  it('worker sin canDelegate notifica aunque haya awaiting (no puede orquestar)', () => {
    const awaiting = new Set<string>(['nested-1'])
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: false })).toBe('notify')
  })

  it('abort libera hold aunque queden nested pendientes', () => {
    const awaiting = new Set<string>(['nested-1'])
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: true, aborted: true })).toBe('notify')
  })

  it('sin padre nunca notifica ni sostiene', () => {
    const awaiting = new Set<string>(['nested-1'])
    expect(decide({ held: false, awaitingNested: awaiting })).toBe('none')
  })

  it('follow-up sin nuevas nested libera el hold', () => {
    const awaiting = new Set<string>(['nested-1'])
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: true })).toBe('hold')
    // El turno agregado arranca; AgentPane limpia awaiting al inicio.
    awaiting.clear()
    // El orquestador no emite fences nuevos → notify.
    expect(decide({ held: true, awaitingNested: awaiting, canDelegate: true })).toBe('notify')
  })
})
