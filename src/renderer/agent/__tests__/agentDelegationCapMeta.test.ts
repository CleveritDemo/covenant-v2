import { describe, expect, it } from 'vitest'
import type { AgentPaneMeta } from '@shared/tabSession'
import { MAX_DELEGATIONS_PER_TURN } from '@shared/agentOrchestration'
import {
  applyMaxDelegationsPerTurnMetaChange,
  resolveTurnMaxDelegationsPerTurn,
} from '../AgentPane'

const baseMeta: AgentPaneMeta = {
  id: 'boss',
  provider: 'claude',
  permissionMode: 'auto',
  coordination: 'orchestrator',
}

describe('applyMaxDelegationsPerTurnMetaChange', () => {
  it('escribe en meta un valor distinto del default', () => {
    const next = applyMaxDelegationsPerTurnMetaChange(baseMeta, 7)
    expect(next.maxDelegationsPerTurn).toBe(7)
  })

  it('elimina la clave al volver al default', () => {
    const withOverride = { ...baseMeta, maxDelegationsPerTurn: 7 }
    const next = applyMaxDelegationsPerTurnMetaChange(withOverride, MAX_DELEGATIONS_PER_TURN)
    expect(next).not.toHaveProperty('maxDelegationsPerTurn')
    expect(next.id).toBe('boss')
  })
})

describe('resolveTurnMaxDelegationsPerTurn', () => {
  it('lleva el valor efectivo del meta al request del turno', () => {
    expect(resolveTurnMaxDelegationsPerTurn(baseMeta)).toBe(MAX_DELEGATIONS_PER_TURN)
    expect(resolveTurnMaxDelegationsPerTurn({ ...baseMeta, maxDelegationsPerTurn: 8 }))
      .toBe(8)
  })
})
