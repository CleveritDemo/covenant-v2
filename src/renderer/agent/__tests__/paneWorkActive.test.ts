import { describe, expect, it } from 'vitest'
import { collectBusyTabIds, collectTabActivityDots, isAgentComposerBadgeActive, isPaneWorkActive, resolvePlaneActivityDot, resolveThreadChipActivityDot } from '../paneWorkActive'

const empty = new Set<string>()

describe('isPaneWorkActive', () => {
  it('marks busy from busyPanes or delegation targets', () => {
    expect(isPaneWorkActive('a', new Set(['a']), empty, null)).toBe(true)
    expect(isPaneWorkActive('a', empty, new Set(['a']), null)).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, null)).toBe(false)
  })

  it('marks live plane status work, not queued turns alone', () => {
    expect(isPaneWorkActive('a', empty, empty, { busy: true })).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, { delegationWorkActive: true })).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, { orchestratorBusy: true })).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, { awaitingDelegations: true })).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, { runningThreadIds: ['bg-thread'] })).toBe(true)
    expect(isPaneWorkActive('a', empty, empty, {})).toBe(false)
  })
})

describe('isAgentComposerBadgeActive', () => {
  it('lights the badge when a background thread is running', () => {
    expect(isAgentComposerBadgeActive({
      busy: false,
      runningThreadIds: ['human-bg'],
    })).toBe(true)
  })

  it('falls back to entity busy flags when plane status is missing', () => {
    expect(isAgentComposerBadgeActive(null, true, false)).toBe(true)
    expect(isAgentComposerBadgeActive(null, false, true)).toBe(true)
    expect(isAgentComposerBadgeActive(null, false, false)).toBe(false)
  })
})

describe('collectBusyTabIds', () => {
  it('lights a tab when any pane inside is working', () => {
    const tabs = [
      { id: 't1', paneIds: ['idle', 'worker'] },
      { id: 't2', paneIds: ['quiet'] },
    ]
    const ids = collectBusyTabIds(
      tabs,
      empty,
      empty,
      { worker: { busy: true } },
    )
    expect([...ids]).toEqual(['t1'])
  })

  it('lights a tab for delegated work on a non-active pane', () => {
    const tabs = [{ id: 'ws', paneIds: ['orch', 'spec'] }]
    const ids = collectBusyTabIds(
      tabs,
      empty,
      new Set(['spec']),
      { orch: { awaitingDelegations: true } },
    )
    expect(ids.has('ws')).toBe(true)
  })
})

describe('resolvePlaneActivityDot', () => {
  it('shows busy while CLI is active, delegating after idle', () => {
    expect(resolvePlaneActivityDot({
      busy: true,
      awaitingDelegations: true,
    })).toBe('busy')
    expect(resolvePlaneActivityDot({
      busy: false,
      awaitingDelegations: true,
    })).toBe('delegating')
  })

  it('returns busy for pane-level signals', () => {
    expect(resolvePlaneActivityDot(null, { paneBusy: true })).toBe('busy')
    expect(resolvePlaneActivityDot({ runningThreadIds: ['t1'] })).toBe('busy')
    expect(resolvePlaneActivityDot({ awaitingDelegations: true })).toBe('delegating')
    expect(resolvePlaneActivityDot({})).toBe(null)
  })
})

describe('collectTabActivityDots', () => {
  it('marks delegating when an orchestrator awaits in the tab', () => {
    const tabs = [{ id: 'ws', paneIds: ['orch', 'idle'] }]
    const dots = collectTabActivityDots(
      tabs,
      empty,
      empty,
      new Set(['orch']),
      {},
    )
    expect(dots.get('ws')).toBe('delegating')
  })

  it('marks busy when only execution is live', () => {
    const tabs = [{ id: 'ws', paneIds: ['worker'] }]
    const dots = collectTabActivityDots(
      tabs,
      new Set(['worker']),
      empty,
      empty,
      {},
    )
    expect(dots.get('ws')).toBe('busy')
  })
})

describe('resolveThreadChipActivityDot', () => {
  it('shows delegating on the active thread when awaiting and idle', () => {
    expect(resolveThreadChipActivityDot('t-1', 't-1', true, [], false)).toBe('delegating')
    expect(resolveThreadChipActivityDot('t-2', 't-1', true, [], false)).toBe(null)
  })

  it('hides delegating on the active chip while CLI is busy', () => {
    expect(resolveThreadChipActivityDot('t-1', 't-1', true, [], true)).toBe(null)
    expect(resolveThreadChipActivityDot('t-2', 't-1', true, ['t-2'], true)).toBe('busy')
  })

  it('shows busy on background running threads', () => {
    expect(resolveThreadChipActivityDot('t-2', 't-1', false, ['t-2'])).toBe('busy')
  })

  it('shows delegating only on threads in awaitingThreadIds', () => {
    expect(resolveThreadChipActivityDot('t-B', 't-B', true, [], false, ['t-A'])).toBe(null)
    expect(resolveThreadChipActivityDot('t-A', 't-B', true, [], false, ['t-A'])).toBe('delegating')
  })
})
