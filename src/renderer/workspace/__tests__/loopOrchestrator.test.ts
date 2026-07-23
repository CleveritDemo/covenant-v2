import { describe, expect, it } from 'vitest'
import { LOOP_INTERVAL_PRESETS } from '@shared/agentLoop'
import { createLoopChain, appendLoopStep } from '@shared/planeLoopChain'
import {
  advanceLoopChainAfterStep,
  resumeLoopChainAfterWait,
  startLoopChain,
  stopLoopChain,
} from '../loopOrchestrator'

const INTERVAL = LOOP_INTERVAL_PRESETS[0].ms

function sampleChain() {
  return appendLoopStep(
    appendLoopStep(createLoopChain('a', 'oa', INTERVAL)!, 'b', 'ob')!,
    'c',
    'oc',
  )!
}

describe('loopOrchestrator', () => {
  it('starts at cursor and advances A→B→C then waits', () => {
    const chain = sampleChain()
    const started = startLoopChain(chain)
    expect(started.chain.status).toBe('running')
    expect(started.action).toEqual({
      type: 'send_step',
      paneId: 'a',
      objective: 'oa',
      stepIndex: 0,
    })

    const toB = advanceLoopChainAfterStep(started.chain)
    expect(toB.action).toMatchObject({ type: 'send_step', paneId: 'b', stepIndex: 1 })

    const toC = advanceLoopChainAfterStep(toB.chain)
    expect(toC.action).toMatchObject({ type: 'send_step', paneId: 'c', stepIndex: 2 })

    const wait = advanceLoopChainAfterStep(toC.chain)
    expect(wait.chain.status).toBe('waiting')
    expect(wait.chain.cursor).toBe(0)
    expect(wait.action).toEqual({ type: 'start_wait', intervalMs: INTERVAL })

    const again = resumeLoopChainAfterWait(wait.chain)
    expect(again.action).toMatchObject({ type: 'send_step', paneId: 'a', stepIndex: 0 })
    expect(again.chain.status).toBe('running')
  })

  it('stop freezes running chain and resets cursor to 0', () => {
    const started = startLoopChain(sampleChain())
    const toB = advanceLoopChainAfterStep(started.chain)
    expect(toB.chain.cursor).toBe(1)
    const stopped = stopLoopChain(toB.chain)
    expect(stopped.status).toBe('stopped')
    expect(stopped.cursor).toBe(0)
    const noop = advanceLoopChainAfterStep(stopped)
    expect(noop.action.type).toBe('noop')
    const again = startLoopChain(stopped)
    expect(again.action).toMatchObject({ type: 'send_step', paneId: 'a', stepIndex: 0 })
  })

  it('start ignores leftover cursor and always begins at step 0', () => {
    const mid = { ...sampleChain(), status: 'stopped' as const, cursor: 2 }
    const started = startLoopChain(mid)
    expect(started.action).toMatchObject({ type: 'send_step', paneId: 'a', stepIndex: 0 })
    expect(started.chain.cursor).toBe(0)
  })

  it('does not double-start a running chain', () => {
    const started = startLoopChain(sampleChain())
    const again = startLoopChain(started.chain)
    expect(again.action.type).toBe('noop')
  })
})
