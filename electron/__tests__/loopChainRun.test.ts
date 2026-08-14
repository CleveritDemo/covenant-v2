import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProjectAgentDefinition } from '../../src/shared/projectAgentCatalog'
import type { AppConfig } from '../../src/shared/configSchema'
import type { LoopChainEvent } from '../../src/shared/loopChainEvents'
import { MAX_AGENT_LOOP_ITERATIONS } from '../../src/shared/agentLoop'

import type { RunLoopChainTurn } from '../loopChainRun'

const userDataRoot = mkdtempSync(join(tmpdir(), 'loop-chain-run-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataRoot },
}))

function agent(id: string, name = id): ProjectAgentDefinition {
  return {
    id,
    name,
    provider: 'claude',
    permissionMode: 'auto',
    role: `${name} role`,
  }
}

function fakeWindow(id = 1): { win: import('electron').BrowserWindow; sent: Array<{ chainId: string; event: LoopChainEvent }> } {
  const sent: Array<{ chainId: string; event: LoopChainEvent }> = []
  const win = {
    id,
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, chainId: string, event: LoopChainEvent) => {
        sent.push({ chainId, event })
      },
    },
  }
  return { win: win as unknown as import('electron').BrowserWindow, sent }
}

const baseConfig = { agentCliCommands: {} } as AppConfig

const {
  clearLoopChainRunsForTests,
  startLoopChainRun,
  stopLoopChainRun,
  stopLoopChainRunsForWindow,
  getLoopChainTranscript,
} = await import('../loopChainRun')
const { clearHeadlessTurnQueueForTests } = await import('../headlessTurnQueue')
const { resetLoopChainTranscriptForTests } = await import('../loopChainTranscript')

afterEach(() => {
  clearLoopChainRunsForTests()
  clearHeadlessTurnQueueForTests()
  resetLoopChainTranscriptForTests('chain-1')
  resetLoopChainTranscriptForTests('chain-max')
})

describe('loopChainRun', () => {
  it('runs three steps in order, not in parallel', async () => {
    const { win, sent } = fakeWindow()
    const order: string[] = []
    let active = 0
    let maxActive = 0

    const runTurn: RunLoopChainTurn = async input => {
      order.push(`start:${input.agent.id}`)
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>(resolve => setTimeout(resolve, 5))
      active -= 1
      order.push(`end:${input.agent.id}`)
      return { ok: true, text: `${input.agent.id} ok` }
    }

    const started = startLoopChainRun(
      win,
      {
        chainId: 'chain-1',
        steps: [
          { agentId: 'a', objective: 'one' },
          { agentId: 'b', objective: 'two' },
          { agentId: 'c', objective: 'three' },
        ],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a'), agent('b'), agent('c')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: 1 },
    )
    expect(started).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(sent.some(item => item.event.type === 'run_end')).toBe(true)
    }, { timeout: 3000 })

    expect(order).toEqual([
      'start:a', 'end:a',
      'start:b', 'end:b',
      'start:c', 'end:c',
    ])
    expect(maxActive).toBe(1)
  })

  it('reuses cliSessionId from the first cycle on the second cycle for the same agent', async () => {
    const { win, sent } = fakeWindow()
    const sessions: string[] = []

    const runTurn: RunLoopChainTurn = async input => {
      if (input.onSession) input.onSession(`session-${input.agent.id}`)
      sessions.push(input.cliSessionId ?? '')
      return { ok: true, text: 'done' }
    }

    startLoopChainRun(
      win,
      {
        chainId: 'chain-1',
        steps: [{ agentId: 'a', objective: 'loop' }],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: 2 },
    )

    await vi.waitFor(() => {
      expect(sent.filter(item => item.event.type === 'cycle_end')).toHaveLength(2)
    }, { timeout: 3000 })

    expect(sessions).toEqual(['', 'session-a'])
  })

  it('stop mid-cycle does not start the next step and emits run_end stopped', async () => {
    const { win, sent } = fakeWindow()
    let releaseFirst: (() => void) | undefined
    const started: string[] = []

    const runTurn: RunLoopChainTurn = async input => {
      started.push(input.agent.id)
      if (input.agent.id === 'a') {
        await new Promise<void>(resolve => {
          releaseFirst = resolve
        })
      }
      return { ok: true, text: 'ok' }
    }

    startLoopChainRun(
      win,
      {
        chainId: 'chain-1',
        steps: [
          { agentId: 'a', objective: 'one' },
          { agentId: 'b', objective: 'two' },
        ],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a'), agent('b')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: 5 },
    )

    await vi.waitFor(() => {
      expect(started).toEqual(['a'])
    })

    stopLoopChainRun('chain-1', { win, notify: true })
    releaseFirst?.()

    await vi.waitFor(() => {
      expect(sent.some(item => item.event.type === 'run_end')).toBe(true)
    })

    expect(started).toEqual(['a'])
    expect(sent.some(item => (
      item.event.type === 'run_end'
      && item.event.reason === 'stopped'
    ))).toBe(true)
  })

  it('stopLoopChainRunsForWindow emits run_end stopped before clearing when win is provided', async () => {
    const { win, sent } = fakeWindow(42)
    let releaseFirst: (() => void) | undefined
    const started: string[] = []

    const runTurn: RunLoopChainTurn = async input => {
      started.push(input.agent.id)
      if (input.agent.id === 'a') {
        await new Promise<void>(resolve => {
          releaseFirst = resolve
        })
      }
      return { ok: true, text: 'ok' }
    }

    startLoopChainRun(
      win,
      {
        chainId: 'chain-1',
        steps: [
          { agentId: 'a', objective: 'one' },
          { agentId: 'b', objective: 'two' },
        ],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a'), agent('b')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: 5 },
    )

    await vi.waitFor(() => {
      expect(started).toEqual(['a'])
    })

    stopLoopChainRunsForWindow(42, win)
    releaseFirst?.()

    await vi.waitFor(() => {
      expect(sent.some(item => item.event.type === 'run_end')).toBe(true)
    })

    expect(started).toEqual(['a'])
    expect(sent.some(item => (
      item.event.type === 'run_end'
      && item.event.reason === 'stopped'
    ))).toBe(true)
  })

  it('closes with max at iteration cap', async () => {
    const { win, sent } = fakeWindow()
    const runTurn: RunLoopChainTurn = async () => ({ ok: true, text: 'ok' })

    startLoopChainRun(
      win,
      {
        chainId: 'chain-max',
        steps: [{ agentId: 'a', objective: 'loop' }],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: MAX_AGENT_LOOP_ITERATIONS },
    )

    await vi.waitFor(() => {
      expect(sent.some(item => (
        item.event.type === 'run_end'
        && item.event.reason === 'max'
      ))).toBe(true)
    }, { timeout: 10_000 })

    expect(sent.filter(item => item.event.type === 'cycle_end')).toHaveLength(
      MAX_AGENT_LOOP_ITERATIONS,
    )
  })

  it('transcript accumulates one entry per step with cycle and index', async () => {
    const { win } = fakeWindow()
    const runTurn: RunLoopChainTurn = async input => ({
      ok: true,
      text: `${input.agent.id}:${input.prompt}`,
    })

    startLoopChainRun(
      win,
      {
        chainId: 'chain-1',
        steps: [
          { agentId: 'a', objective: 'first' },
          { agentId: 'b', objective: 'second' },
        ],
        intervalMs: 0,
        cwd: '/tmp',
        agents: [agent('a'), agent('b')],
      },
      baseConfig,
      '/home',
      { runTurn, maxCycles: 2 },
    )

    await vi.waitFor(() => {
      const transcript = getLoopChainTranscript('chain-1')
      expect(transcript?.entries).toHaveLength(4)
    }, { timeout: 3000 })

    const transcript = getLoopChainTranscript('chain-1')
    expect(transcript?.entries.map(entry => ({
      cycle: entry.cycle,
      stepIndex: entry.stepIndex,
      agentId: entry.agentId,
    }))).toEqual([
      { cycle: 1, stepIndex: 0, agentId: 'a' },
      { cycle: 1, stepIndex: 1, agentId: 'b' },
      { cycle: 2, stepIndex: 0, agentId: 'a' },
      { cycle: 2, stepIndex: 1, agentId: 'b' },
    ])
  })
})
