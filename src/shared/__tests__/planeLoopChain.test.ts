import { describe, expect, it } from 'vitest'
import { LOOP_INTERVAL_PRESETS } from '@shared/agentLoop'
import {
  activeLoopChainPaneIds,
  appendLoopStep,
  canAppendLoopStep,
  createLoopChain,
  moveLoopStep,
  paneIdsUsedInLoopChains,
  planeLoopChainsForPersist,
  removePaneFromLoopChains,
  sanitizePlaneLoopChains,
  setLoopStepObjective,
} from '@shared/planeLoopChain'

describe('planeLoopChain', () => {
  it('creates a single-step chain and snaps interval to chat presets', () => {
    expect(createLoopChain('', 'go')).toBeNull()
    expect(createLoopChain('a', '  ')).toBeNull()
    const chain = createLoopChain('a', '  ship  ', 2500)
    expect(chain).not.toBeNull()
    expect(chain!.steps).toEqual([{ paneId: 'a', objective: 'ship' }])
    expect(chain!.intervalMs).toBe(LOOP_INTERVAL_PRESETS[0].ms)
    expect(chain!.status).toBe('idle')
    expect(chain!.cursor).toBe(0)
  })

  it('appends unique agents only', () => {
    const base = createLoopChain('a', 'one')!
    expect(canAppendLoopStep(base, 'a')).toBe(false)
    expect(appendLoopStep(base, 'a', 'dup')).toBeNull()
    const next = appendLoopStep(base, 'b', 'two')
    expect(next?.steps.map(s => s.paneId)).toEqual(['a', 'b'])
  })

  it('sanitizes unknown panes, duplicates and resets status', () => {
    const agents = new Set(['a', 'b'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { paneId: 'a', objective: ' x ' },
            { paneId: 'missing', objective: 'y' },
            { paneId: 'a', objective: 'dup' },
            { paneId: 'b', objective: 'z' },
          ],
          intervalMs: 999,
          status: 'running',
          cursor: 9,
        },
        { id: 'empty', steps: [{ paneId: 'gone', objective: 'no' }] },
      ],
      agents,
    )
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0]?.id).toBe('c1')
    expect(cleaned[0]?.steps).toEqual([
      { paneId: 'a', objective: 'x' },
      { paneId: 'b', objective: 'z' },
    ])
    expect(cleaned[0]?.status).toBe('idle')
    expect(cleaned[0]?.cursor).toBe(0)
    expect(cleaned[0]?.intervalMs).toBe(LOOP_INTERVAL_PRESETS[0].ms)
  })

  it('keeps each agent in at most one chain when sanitizing', () => {
    const agents = new Set(['a', 'b', 'c'])
    const cleaned = sanitizePlaneLoopChains(
      [
        {
          id: 'c1',
          steps: [
            { paneId: 'a', objective: 'one' },
            { paneId: 'b', objective: 'two' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 0,
        },
        {
          id: 'c2',
          steps: [
            { paneId: 'b', objective: 'dup' },
            { paneId: 'c', objective: 'three' },
          ],
          intervalMs: LOOP_INTERVAL_PRESETS[0].ms,
          status: 'idle',
          cursor: 1,
        },
      ],
      agents,
    )
    expect(cleaned).toHaveLength(2)
    expect(cleaned[0]?.steps.map(s => s.paneId)).toEqual(['a', 'b'])
    expect(cleaned[1]?.steps.map(s => s.paneId)).toEqual(['c'])
    expect(cleaned[1]?.cursor).toBe(0)
  })

  it('lists pane ids used across chains excluding one', () => {
    const a = createLoopChain('a', 'one')!
    const b = appendLoopStep(createLoopChain('b', 'two')!, 'c', 'three')!
    expect([...paneIdsUsedInLoopChains([a, b])].sort()).toEqual(['a', 'b', 'c'])
    expect([...paneIdsUsedInLoopChains([a, b], a.id)].sort()).toEqual(['b', 'c'])
  })

  it('removes pane from chains and recalculates cursor', () => {
    const chain = appendLoopStep(
      appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!,
      'c',
      'three',
    )!
    const running = { ...chain, status: 'running' as const, cursor: 2 }
    const next = removePaneFromLoopChains([running], 'b')
    expect(next).toHaveLength(1)
    expect(next[0]?.steps.map(step => step.paneId)).toEqual(['a', 'c'])
    expect(next[0]?.cursor).toBe(1)
    expect(next[0]?.status).toBe('stopped')
  })

  it('reorders steps and ignores out-of-range moves', () => {
    const chain = appendLoopStep(
      appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!,
      'c',
      'three',
    )!
    expect(moveLoopStep(chain, 2, 0).steps.map(step => step.paneId)).toEqual(['c', 'a', 'b'])
    expect(moveLoopStep(chain, 0, 1).steps.map(step => step.paneId)).toEqual(['b', 'a', 'c'])
    expect(moveLoopStep(chain, 1, 1)).toBe(chain)
    expect(moveLoopStep(chain, -1, 0)).toBe(chain)
    expect(moveLoopStep(chain, 0, 3)).toBe(chain)
  })

  it('edits a step objective in place, ignoring blanks', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    expect(setLoopStepObjective(chain, 'b', '  three  ').steps).toEqual([
      { paneId: 'a', objective: 'one' },
      { paneId: 'b', objective: 'three' },
    ])
    expect(setLoopStepObjective(chain, 'b', '   ')).toBe(chain)
    expect(setLoopStepObjective(chain, 'zz', 'nope').steps).toEqual(chain.steps)
  })

  it('lists panes of running or waiting chains', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    expect(activeLoopChainPaneIds([{ ...chain, status: 'idle' }]).size).toBe(0)
    expect([...activeLoopChainPaneIds([{ ...chain, status: 'running' }])].sort()).toEqual(['a', 'b'])
  })

  it('persists only idle config (no running state or cursor)', () => {
    const chain = appendLoopStep(createLoopChain('a', 'one')!, 'b', 'two')!
    const running = { ...chain, status: 'waiting' as const, cursor: 1 }
    const persisted = planeLoopChainsForPersist([running])
    expect(persisted).toEqual([{
      id: chain.id,
      steps: [
        { paneId: 'a', objective: 'one' },
        { paneId: 'b', objective: 'two' },
      ],
      intervalMs: chain.intervalMs,
      status: 'idle',
      cursor: 0,
    }])
    expect(planeLoopChainsForPersist([])).toBeUndefined()
    expect(planeLoopChainsForPersist(undefined)).toBeUndefined()
  })
})
