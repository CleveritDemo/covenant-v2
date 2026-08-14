import { describe, expect, it, vi } from 'vitest'

const watcherPauseState = vi.hoisted(() => ({ count: 0 }))

vi.mock('../fileExplorerWatcher', () => ({
  pauseFileExplorerWatchesForCwd: () => {
    watcherPauseState.count++
    return () => { watcherPauseState.count-- }
  },
}))

import {
  registerTurnCleanup,
  reserveAgentRun,
  stopAgentRun,
} from '../agentCliRuntime'
import { pauseFileExplorerWatchesForCwd } from '../fileExplorerWatcher'

describe('agentCliRuntime turn cleanup', () => {
  it('stopAgentRun releases the file watcher pause registered for the turn', () => {
    const paneId = 'pane-watcher-cleanup'
    watcherPauseState.count = 0

    reserveAgentRun(paneId, null)

    const releaseWatcherPause = pauseFileExplorerWatchesForCwd('/tmp/project')
    registerTurnCleanup(paneId, releaseWatcherPause)
    expect(watcherPauseState.count).toBe(1)

    stopAgentRun(paneId, { notify: true })

    expect(watcherPauseState.count).toBe(0)
  })
})
