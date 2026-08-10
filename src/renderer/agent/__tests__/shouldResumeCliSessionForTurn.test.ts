import { describe, expect, it } from 'vitest'
import { shouldResumeCliSessionForTurn } from '../shouldResumeCliSessionForTurn'

describe('shouldResumeCliSessionForTurn', () => {
  it('returns false when orchestrator delegation is present', () => {
    expect(shouldResumeCliSessionForTurn({
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec' },
    })).toBe(false)
  })

  it('returns true for human turns (no delegation)', () => {
    expect(shouldResumeCliSessionForTurn({})).toBe(true)
  })

  it('returns true when delegation is explicitly undefined', () => {
    expect(shouldResumeCliSessionForTurn({ delegation: undefined })).toBe(true)
  })

  // Misma respuesta, segunda consecuencia: el pane la usa para decidir si se
  // queda con el cliSessionId que emita el CLI. Devolver `true` para una
  // subtarea dejaría el hilo del agente apuntando al job del orquestador.
  it('una subtarea tampoco adopta la sesión que emite su CLI', () => {
    const delegated = shouldResumeCliSessionForTurn({
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec' },
    })
    expect(delegated).toBe(false)
  })
})
