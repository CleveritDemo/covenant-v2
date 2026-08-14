import { describe, expect, it, vi } from 'vitest'
import { buildRunKey } from '@shared/agentRunKey'
import {
  applyDelegationLaneStop,
  collectOrchestratorPendingLaneStops,
  resolveSingleDelegationLaneStop,
} from '../orchestrationAbort'

describe('abort por carril de hilo', () => {
  it('dos delegaciones vivas en carriles distintos del mismo pane: abortar una solo para su runKey', () => {
    const pending = [
      { toPaneId: 'pane-fe', toThreadId: 'thread-d1' },
      { toPaneId: 'pane-fe', toThreadId: 'thread-d2' },
    ]

    const laneStop = resolveSingleDelegationLaneStop({
      toPaneId: 'pane-fe',
      pendingToThreadId: pending[0].toThreadId,
    })

    const stopRunKey = vi.fn<(runKey: string) => void>()
    const stopPane = vi.fn<(paneId: string) => void>()
    const warn = vi.fn<(payload: Record<string, unknown>) => void>()

    applyDelegationLaneStop(laneStop, { delegationId: 'd1' }, {
      stopRunKey,
      stopPane,
      warn,
    })

    expect(stopRunKey).toHaveBeenCalledTimes(1)
    expect(stopRunKey).toHaveBeenCalledWith(buildRunKey('pane-fe', 'thread-d1'))
    expect(stopRunKey).not.toHaveBeenCalledWith(buildRunKey('pane-fe', 'thread-d2'))
    expect(stopPane).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('abort del orquestador para cada carril pending sin tocar otros panes', () => {
    const pending = [
      { toPaneId: 'pane-fe', toThreadId: 'thread-a' },
      { toPaneId: 'pane-fe', toThreadId: 'thread-b' },
      { toPaneId: 'pane-be', toThreadId: 'thread-c' },
    ]

    const targets = collectOrchestratorPendingLaneStops(pending)
    expect(targets).toHaveLength(3)

    const stoppedRunKeys: string[] = []
    for (const target of targets) {
      applyDelegationLaneStop(target, {}, {
        stopRunKey: runKey => { stoppedRunKeys.push(runKey) },
        stopPane: () => { throw new Error('unexpected pane stop') },
        warn: () => { throw new Error('unexpected warn') },
      })
    }

    expect(stoppedRunKeys).toEqual([
      buildRunKey('pane-fe', 'thread-a'),
      buildRunKey('pane-fe', 'thread-b'),
      buildRunKey('pane-be', 'thread-c'),
    ])
  })

  it('cae al stop por pane si falta toThreadId', () => {
    const laneStop = resolveSingleDelegationLaneStop({ toPaneId: 'pane-fe' })

    const stopRunKey = vi.fn<(runKey: string) => void>()
    const stopPane = vi.fn<(paneId: string) => void>()
    const warn = vi.fn<(payload: Record<string, unknown>) => void>()

    applyDelegationLaneStop(laneStop, { delegationId: 'd-missing' }, {
      stopRunKey,
      stopPane,
      warn,
    })

    expect(stopRunKey).not.toHaveBeenCalled()
    expect(stopPane).toHaveBeenCalledWith('pane-fe')
    expect(warn).toHaveBeenCalledWith({
      delegationId: 'd-missing',
      toPaneId: 'pane-fe',
      reason: 'abort_lane_threadid_missing',
    })
  })
})
