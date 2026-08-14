import { describe, expect, it } from 'vitest'
import { LOOP_INTERVAL_PRESETS } from '@shared/agentLoop'
import {
  activeLoopChainAgentIds,
  appendLoopStep,
  canAppendLoopStep,
  createLoopChain,
  moveLoopStep,
  agentIdsUsedInLoopChains,
  planeLoopChainsForPersist,
  removeAgentFromLoopChains,
  sanitizePlaneLoopChains,
  setLoopStepObjective,
} from '@shared/planeLoopChain'
import { sanitizePlaneLoopNodePositions } from '@shared/planeLoopGraph'

describe('planeLoopChain', () => {
  it('creates a single-step chain and snaps interval to chat presets', () => {
    expect(createLoopChain('', 'go')).toBeNull()
    expect(createLoopChain('a', '  ')).toBeNull()
    const chain = createLoopChain('a', '  ship  ', 2500)
    expect(chain).not.toBeNull()
    expect(chain!.steps).toEqual([{ agentId: 'a', objective: 'ship' }])
    expect(chain!.intervalMs).toBe(LOOP_INTERVAL_PRESETS[0].ms)
    expect(chain!.status).toBe('idle')
    expect(chain!.cursor).toBe(0)
  })

  it('appends unique agents only', () => {
    const base = createLoopChain('a', 'one')!
    expect(canAppendLoopStep(base, 'a')).toBe(false)
    expect(appendLoopStep(base, 'a', 'dup')).toBeNull()
    const next = appendLoopStep(base, 'b', 'two')
    expect(next?.steps.map(s => s.agentId)).toEqual(['a', 'b'])
  })

  it('sanitizes unknown agents, duplicates and resets status', () => {
    const agents = new Set(['a', 'b'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { agentId: 'a', objective: ' x ' },
            { agentId: 'missing', objective: 'y' },
            { agentId: 'a', objective: 'dup' },
            { agentId: 'b', objective: 'z' },
          ],
          intervalMs: 999,
          status: 'running',
          cursor: 9,
        },
        { id: 'empty', steps: [{ agentId: 'gone', objective: 'no' }] },
      ],
      agents,
    )
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0]?.id).toBe('c1')
    expect(cleaned[0]?.steps).toEqual([
      { agentId: 'a', objective: 'x' },
      { agentId: 'b', objective: 'z' },
    ])
    expect(cleaned[0]?.status).toBe('idle')
    expect(cleaned[0]?.cursor).toBe(0)
    expect(cleaned[0]?.intervalMs).toBe(LOOP_INTERVAL_PRESETS[0].ms)
  })

  it('migrates legacy paneId steps via paneIdToAgentId', () => {
    const agents = new Set(['karl', 'david'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { paneId: 'pane-karl', objective: 'one' },
            { paneId: 'pane-david', objective: 'two' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 0,
        },
      ],
      agents,
      { 'pane-karl': 'karl', 'pane-david': 'david' },
    )
    expect(cleaned[0]?.steps).toEqual([
      { agentId: 'karl', objective: 'one' },
      { agentId: 'david', objective: 'two' },
    ])
  })

  it('discards legacy paneId steps that cannot be resolved', () => {
    const agents = new Set(['karl'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { paneId: 'pane-karl', objective: 'one' },
            { paneId: 'pane-gone', objective: 'two' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 0,
        },
      ],
      agents,
      { 'pane-karl': 'karl' },
    )
    expect(cleaned[0]?.steps).toEqual([{ agentId: 'karl', objective: 'one' }])
  })

  it('migrates legacy paneId node positions', () => {
    const agents = new Set(['karl'])
    const positions = sanitizePlaneLoopNodePositions(
      { 'pane-karl': { x: 10, y: 20 } },
      agents,
      { 'pane-karl': 'karl' },
    )
    expect(positions).toEqual({ karl: { x: 10, y: 20 } })
  })

  it('keeps each agent in at most one chain when sanitizing', () => {
    const agents = new Set(['a', 'b', 'c'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { agentId: 'a', objective: 'one' },
            { agentId: 'b', objective: 'two' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 0,
        },
        {
          id: 'c2',
          steps: [
            { agentId: 'b', objective: 'dup' },
            { agentId: 'c', objective: 'three' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 1,
        },
      ],
      agents,
    )
    expect(cleaned).toHaveLength(2)
    expect(cleaned[0]?.steps.map(s => s.agentId)).toEqual(['a', 'b'])
    expect(cleaned[1]?.steps.map(s => s.agentId)).toEqual(['c'])
    expect(cleaned[1]?.cursor).toBe(0)
  })

  it('lists agent ids used across chains excluding one', () => {
    const a = createLoopChain('a', 'one')!
    const b = appendLoopStep(createLoopChain('b', 'two')!, 'c', 'three')!
    expect([...agentIdsUsedInLoopChains([a, b])].sort()).toEqual(['a', 'b', 'c'])
    expect([...agentIdsUsedInLoopChains([a, b], a.id)].sort()).toEqual(['b', 'c'])
  })

  it('removes agent from chains and recalculates cursor', () => {
    const chain = appendLoopStep(
      appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!,
      'c',
      'three',
    )!
    const running = { ...chain, status: 'running' as const, cursor: 2 }
    const next = removeAgentFromLoopChains([running], 'b')
    expect(next).toHaveLength(1)
    expect(next[0]?.steps.map(step => step.agentId)).toEqual(['a', 'c'])
    expect(next[0]?.cursor).toBe(1)
    expect(next[0]?.status).toBe('stopped')
  })

  it('reorders steps and ignores out-of-range moves', () => {
    const chain = appendLoopStep(
      appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!,
      'c',
      'three',
    )!
    expect(moveLoopStep(chain, 2, 0).steps.map(step => step.agentId)).toEqual(['c', 'a', 'b'])
    expect(moveLoopStep(chain, 0, 1).steps.map(step => step.agentId)).toEqual(['b', 'a', 'c'])
    expect(moveLoopStep(chain, 1, 1)).toBe(chain)
    expect(moveLoopStep(chain, -1, 0)).toBe(chain)
    expect(moveLoopStep(chain, 0, 3)).toBe(chain)
  })

  it('edits a step objective in place, ignoring blanks', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    expect(setLoopStepObjective(chain, 'b', '  three  ').steps).toEqual([
      { agentId: 'a', objective: 'one' },
      { agentId: 'b', objective: 'three' },
    ])
    expect(setLoopStepObjective(chain, 'b', '   ')).toBe(chain)
    expect(setLoopStepObjective(chain, 'zz', 'nope').steps).toEqual(chain.steps)
  })

  it('lists agents of running or waiting chains', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    expect(activeLoopChainAgentIds([{ ...chain, status: 'idle' }]).size).toBe(0)
    expect([...activeLoopChainAgentIds([{ ...chain, status: 'running' }])].sort()).toEqual(['a', 'b'])
  })

  it('persists only idle config (no running state or cursor)', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    const running = { ...chain, status: 'waiting' as const, cursor: 1 }
    const persisted = planeLoopChainsForPersist([running])
    expect(persisted).toEqual([{
      id: chain.id,
      steps: [
        { agentId: 'a', objective: 'one' },
        { agentId: 'b', objective: 'two' },
      ],
      intervalMs: chain.intervalMs,
      status: 'idle',
      cursor: 0,
    }])
    expect(planeLoopChainsForPersist([])).toBeUndefined()
    expect(planeLoopChainsForPersist(undefined)).toBeUndefined()
  })
})
