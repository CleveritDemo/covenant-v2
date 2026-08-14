import { describe, expect, it } from 'vitest'
import { collectBusyTabIds, isPaneWorkActive } from '../paneWorkActive'

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
    expect(isPaneWorkActive('a', empty, empty, {})).toBe(false)
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
