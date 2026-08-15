import { describe, expect, it } from 'vitest'
import { resolveLaneDelegationTurnEnd } from '../AgentPane'

describe('resolveLaneDelegationTurnEnd', () => {
  it('conserva la entrada del carril cuando el hold retiene la delegación', () => {
    const result = resolveLaneDelegationTurnEnd({
      held: true,
      dispatchedNested: true,
      canDelegate: true,
    })
    expect(result.decision).toBe('hold')
    expect(result.clearLaneDelegation).toBe(false)
  })

  it('borra la entrada del carril cuando la decisión es notify', () => {
    const result = resolveLaneDelegationTurnEnd({
      held: true,
      dispatchedNested: false,
      canDelegate: true,
    })
    expect(result.decision).toBe('notify')
    expect(result.clearLaneDelegation).toBe(true)
  })

  it('borra cuando el worker debe notificar aunque hubo nested', () => {
    const result = resolveLaneDelegationTurnEnd({
      held: true,
      dispatchedNested: true,
      canDelegate: false,
    })
    expect(result.decision).toBe('notify')
    expect(result.clearLaneDelegation).toBe(true)
  })
})
