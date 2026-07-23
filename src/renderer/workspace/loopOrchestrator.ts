import type { PlaneLoopChain, PlaneLoopChainStatus } from '@shared/planeLoopChain'

export type LoopOrchestratorAction =
  | { type: 'send_step'; paneId: string; objective: string; stepIndex: number }
  | { type: 'start_wait'; intervalMs: number }
  | { type: 'noop' }

function withStatus(
  chain: PlaneLoopChain,
  status: PlaneLoopChainStatus,
  cursor = chain.cursor,
): PlaneLoopChain {
  return { ...chain, status, cursor }
}

/** Arranca una cadena idle/stopped siempre desde el paso 0. */
export function startLoopChain(chain: PlaneLoopChain): {
  chain: PlaneLoopChain
  action: LoopOrchestratorAction
} {
  if (chain.steps.length === 0) {
    return { chain: withStatus(chain, 'idle', 0), action: { type: 'noop' } }
  }
  if (chain.status === 'running' || chain.status === 'waiting') {
    return { chain, action: { type: 'noop' } }
  }
  const step = chain.steps[0]!
  return {
    chain: withStatus(chain, 'running', 0),
    action: {
      type: 'send_step',
      paneId: step.paneId,
      objective: step.objective,
      stepIndex: 0,
    },
  }
}

/** Tras completar el turno del paso actual. */
export function advanceLoopChainAfterStep(chain: PlaneLoopChain): {
  chain: PlaneLoopChain
  action: LoopOrchestratorAction
} {
  if (chain.status !== 'running' || chain.steps.length === 0) {
    return { chain, action: { type: 'noop' } }
  }
  const nextIndex = chain.cursor + 1
  if (nextIndex >= chain.steps.length) {
    return {
      chain: withStatus(chain, 'waiting', 0),
      action: { type: 'start_wait', intervalMs: chain.intervalMs },
    }
  }
  const step = chain.steps[nextIndex]!
  return {
    chain: withStatus(chain, 'running', nextIndex),
    action: {
      type: 'send_step',
      paneId: step.paneId,
      objective: step.objective,
      stepIndex: nextIndex,
    },
  }
}

/** Tras el intervalo entre ciclos. */
export function resumeLoopChainAfterWait(chain: PlaneLoopChain): {
  chain: PlaneLoopChain
  action: LoopOrchestratorAction
} {
  if (chain.status !== 'waiting' || chain.steps.length === 0) {
    return { chain, action: { type: 'noop' } }
  }
  const step = chain.steps[0]!
  return {
    chain: withStatus(chain, 'running', 0),
    action: {
      type: 'send_step',
      paneId: step.paneId,
      objective: step.objective,
      stepIndex: 0,
    },
  }
}

/** Detiene la cadena y reinicia el cursor (el próximo start va al paso 0). */
export function stopLoopChain(chain: PlaneLoopChain): PlaneLoopChain {
  return withStatus(chain, 'stopped', 0)
}
