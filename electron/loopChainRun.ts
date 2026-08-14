import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import type { TabContext } from '../src/shared/tabContext'
import type { PlaneLoopStep } from '../src/shared/planeLoopChain'
import { buildLoopPrompt, MAX_AGENT_LOOP_ITERATIONS } from '../src/shared/agentLoop'
import { IPC } from '../src/shared/ipcChannels'
import {
  sanitizeLoopChainId,
  type LoopChainEvent,
  type LoopChainRunEndReason,
  type LoopChainRunStateSnapshot,
  type LoopChainRunStatus,
} from '../src/shared/loopChainEvents'
import {
  headlessRunKey,
  runHeadlessAgentTurn,
  stopHeadlessAgentRuns,
  type HeadlessAgentTurnResult,
} from './agentHeadlessRun'
import { acquireHeadlessTurnSlot, releaseHeadlessTurnSlot } from './headlessTurnQueue'
import { appendLoopChainTranscriptEntry, loadLoopChainTranscript } from './loopChainTranscript'

export type { LoopChainEvent, LoopChainRunStateSnapshot }

export interface LoopChainStartConfig {
  chainId: string
  steps: PlaneLoopStep[]
  intervalMs: number
  cwd: string
  agents: ProjectAgentDefinition[]
  contexts?: TabContext[]
}

export type RunLoopChainTurn = (
  input: {
    chainId: string
    agent: ProjectAgentDefinition
    prompt: string
    cwd: string
    cliSessionId?: string
    contexts?: TabContext[]
    isStale: () => boolean
    onDelta: (text: string) => void
    onSession?: (cliSessionId: string) => void
  },
  config: AppConfig,
  home: string,
) => Promise<HeadlessAgentTurnResult>

interface ChainRunState {
  generation: number
  windowId: number
  chainId: string
  steps: PlaneLoopStep[]
  intervalMs: number
  cwd: string
  agentsById: Map<string, ProjectAgentDefinition>
  contexts: TabContext[]
  cliSessions: Map<string, string>
  activePaneId: string | null
  status: LoopChainRunStatus
  cycle: number
  stepIndex: number
  activeAgentId?: string
  stopReason?: LoopChainRunEndReason
}

const chainRuns = new Map<string, ChainRunState>()
let nextChainGeneration = 1

function emitLoopChain(win: BrowserWindow, chainId: string, event: LoopChainEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC.LOOP_CHAIN_EVENT, chainId, event)
  }
}

function snapshotFromRun(run: ChainRunState): LoopChainRunStateSnapshot {
  return {
    chainId: run.chainId,
    status: run.status,
    cycle: run.cycle,
    stepIndex: run.stepIndex,
    ...(run.activeAgentId ? { activeAgentId: run.activeAgentId } : {}),
    ...(run.stopReason ? { stopReason: run.stopReason } : {}),
  }
}

function sleepMs(ms: number, isStale: () => boolean): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise(resolve => {
    const started = Date.now()
    const tick = (): void => {
      if (isStale()) {
        resolve()
        return
      }
      if (Date.now() - started >= ms) {
        resolve()
        return
      }
      setTimeout(tick, Math.min(50, ms))
    }
    tick()
  })
}

export function defaultRunLoopChainTurn(
  input: Parameters<RunLoopChainTurn>[0],
  config: AppConfig,
  home: string,
): Promise<HeadlessAgentTurnResult> {
  return runHeadlessAgentTurn({
    runnerKind: 'loop',
    runnerId: input.chainId,
    agent: input.agent,
    prompt: input.prompt,
    cwd: input.cwd,
    cliSessionId: input.cliSessionId,
    contexts: input.contexts,
    emitResults: true,
    emitChangelog: false,
    isStale: input.isStale,
    onDelta: input.onDelta,
    onSession: input.onSession,
  }, config, home)
}

function invalidateChainGeneration(run: ChainRunState): void {
  run.generation = nextChainGeneration++
  if (run.activePaneId) {
    stopHeadlessAgentRuns('loop', run.chainId, run.activeAgentId)
    run.activePaneId = null
  }
}

export async function runLoopChainSequence(
  run: ChainRunState,
  deps: {
    win: BrowserWindow
    config: AppConfig
    home: string
    isStale: () => boolean
    runTurn: RunLoopChainTurn
    maxCycles?: number
  },
): Promise<LoopChainRunEndReason | null> {
  const maxCycles = deps.maxCycles ?? MAX_AGENT_LOOP_ITERATIONS
  const { chainId } = run

  run.status = 'running'
  emitLoopChain(deps.win, chainId, { type: 'run_start', chainId })

  while (!deps.isStale() && run.cycle < maxCycles) {
    const cycleNumber = run.cycle + 1

    for (let stepIndex = 0; stepIndex < run.steps.length; stepIndex += 1) {
      if (deps.isStale()) return run.stopReason ?? 'stopped'

      const step = run.steps[stepIndex]!
      const agent = run.agentsById.get(step.agentId)
      if (!agent) {
        emitLoopChain(deps.win, chainId, {
          type: 'error',
          chainId,
          cycle: cycleNumber,
          stepIndex,
          agentId: step.agentId,
          message: `Agente no encontrado: ${step.agentId}`,
        })
        run.status = 'stopped'
        run.stopReason = 'error'
        return 'error'
      }

      run.stepIndex = stepIndex
      run.activeAgentId = step.agentId
      const prompt = buildLoopPrompt(step.objective, cycleNumber)
      emitLoopChain(deps.win, chainId, {
        type: 'step_start',
        chainId,
        cycle: cycleNumber,
        stepIndex,
        agentId: step.agentId,
      })

      await acquireHeadlessTurnSlot()
      if (deps.isStale()) {
        releaseHeadlessTurnSlot()
        return run.stopReason ?? 'stopped'
      }

      const paneId = headlessRunKey('loop', chainId, step.agentId)
      run.activePaneId = paneId

      let result: HeadlessAgentTurnResult
      try {
        result = await deps.runTurn(
          {
            chainId,
            agent,
            prompt,
            cwd: run.cwd,
            cliSessionId: run.cliSessions.get(step.agentId),
            contexts: run.contexts,
            isStale: deps.isStale,
            onDelta: text => {
              if (deps.isStale()) return
              emitLoopChain(deps.win, chainId, {
                type: 'step_delta',
                chainId,
                cycle: cycleNumber,
                stepIndex,
                agentId: step.agentId,
                text,
              })
            },
            onSession: cliSessionId => {
              if (!deps.isStale()) {
                run.cliSessions.set(step.agentId, cliSessionId)
              }
            },
          },
          deps.config,
          deps.home,
        )
      } finally {
        releaseHeadlessTurnSlot()
        if (run.activePaneId === paneId) run.activePaneId = null
      }

      if (deps.isStale()) return run.stopReason ?? 'stopped'

      const timestamp = new Date().toISOString()
      if (!result.ok) {
        if (result.aborted) return run.stopReason ?? 'stopped'
        const message = result.error || 'Turno de loop fallido.'
        emitLoopChain(deps.win, chainId, {
          type: 'error',
          chainId,
          cycle: cycleNumber,
          stepIndex,
          agentId: step.agentId,
          message,
        })
        appendLoopChainTranscriptEntry(chainId, {
          cycle: cycleNumber,
          stepIndex,
          agentId: step.agentId,
          prompt,
          text: '',
          timestamp,
          error: message,
        })
        run.status = 'stopped'
        run.stopReason = 'error'
        return 'error'
      }

      const text = result.text.trim()
      appendLoopChainTranscriptEntry(chainId, {
        cycle: cycleNumber,
        stepIndex,
        agentId: step.agentId,
        prompt,
        text,
        timestamp,
      })
      emitLoopChain(deps.win, chainId, {
        type: 'step_final',
        chainId,
        cycle: cycleNumber,
        stepIndex,
        agentId: step.agentId,
        text,
      })
    }

    run.cycle = cycleNumber
    run.stepIndex = 0
    run.activeAgentId = undefined
    emitLoopChain(deps.win, chainId, { type: 'cycle_end', chainId, cycle: cycleNumber })

    if (deps.isStale() || run.cycle >= maxCycles) break

    run.status = 'waiting'
    await sleepMs(run.intervalMs, deps.isStale)
    if (deps.isStale()) return run.stopReason ?? 'stopped'
    run.status = 'running'
  }

  if (run.cycle >= maxCycles) {
    run.status = 'stopped'
    run.stopReason = 'max'
    return 'max'
  }

  return run.stopReason ?? null
}

export function startLoopChainRun(
  win: BrowserWindow,
  config: LoopChainStartConfig,
  appConfig: AppConfig,
  home: string,
  options?: {
    runTurn?: RunLoopChainTurn
    maxCycles?: number
  },
): { ok: true } | { ok: false; error: string } {
  const chainId = sanitizeLoopChainId(config.chainId)
  if (!chainId) return { ok: false, error: 'chainId inválido' }

  const cwd = typeof config.cwd === 'string' ? config.cwd.trim() : ''
  if (!cwd) return { ok: false, error: 'cwd inválido' }

  const steps = (Array.isArray(config.steps) ? config.steps : [])
    .map(step => ({
      agentId: typeof step.agentId === 'string' ? step.agentId.trim() : '',
      objective: typeof step.objective === 'string' ? step.objective.trim() : '',
    }))
    .filter(step => step.agentId && step.objective)
  if (steps.length === 0) return { ok: false, error: 'cadena sin pasos válidos' }

  const intervalMs = Number.isFinite(config.intervalMs) ? Math.max(0, config.intervalMs) : 0
  const agents = Array.isArray(config.agents) ? config.agents : []
  const agentsById = new Map(agents.map(agent => [agent.id, agent]))
  for (const step of steps) {
    if (!agentsById.has(step.agentId)) {
      return { ok: false, error: `agente no encontrado: ${step.agentId}` }
    }
  }

  const contexts = Array.isArray(config.contexts) ? config.contexts : []

  const previous = chainRuns.get(chainId)
  if (previous) invalidateChainGeneration(previous)

  const generation = nextChainGeneration++
  const state: ChainRunState = {
    generation,
    windowId: win.id,
    chainId,
    steps,
    intervalMs,
    cwd,
    agentsById,
    contexts,
    cliSessions: previous ? new Map(previous.cliSessions) : new Map(),
    activePaneId: null,
    status: 'running',
    cycle: 0,
    stepIndex: 0,
  }
  chainRuns.set(chainId, state)

  const isStale = (): boolean => chainRuns.get(chainId)?.generation !== generation
  const runTurn = options?.runTurn ?? defaultRunLoopChainTurn

  void (async () => {
    const reason = await runLoopChainSequence(state, {
      win,
      config: appConfig,
      home,
      isStale,
      runTurn,
      maxCycles: options?.maxCycles,
    })

    const current = chainRuns.get(chainId)
    if (!current || current.generation !== generation) return

    const endReason: LoopChainRunEndReason = reason ?? current.stopReason ?? 'stopped'
    if (!current.stopReason) current.stopReason = endReason
    current.status = 'stopped'
    current.activeAgentId = undefined
    emitLoopChain(win, chainId, { type: 'run_end', chainId, reason: endReason })
    chainRuns.delete(chainId)
  })()

  return { ok: true }
}

export function stopLoopChainRun(
  chainId: string,
  options?: { win?: BrowserWindow; notify?: boolean },
): void {
  const id = sanitizeLoopChainId(chainId)
  if (!id) return
  const run = chainRuns.get(id)
  if (!run) return

  run.status = 'stopped'
  run.stopReason = 'stopped'

  if (options?.notify && options.win) {
    emitLoopChain(options.win, id, { type: 'run_end', chainId: id, reason: 'stopped' })
  }

  invalidateChainGeneration(run)
  stopHeadlessAgentRuns('loop', id)
  chainRuns.delete(id)
}

export function stopLoopChainRunsForWindow(windowId: number, win?: BrowserWindow): void {
  for (const [chainId, run] of [...chainRuns.entries()]) {
    if (run.windowId === windowId) {
      stopLoopChainRun(chainId, win ? { win, notify: true } : undefined)
    }
  }
}

export function stopAllLoopChainRuns(): void {
  for (const chainId of [...chainRuns.keys()]) {
    stopLoopChainRun(chainId)
  }
}

export function getLoopChainRunState(chainId: string): LoopChainRunStateSnapshot | null {
  const id = sanitizeLoopChainId(chainId)
  if (!id) return null
  const run = chainRuns.get(id)
  if (!run) return null
  return snapshotFromRun(run)
}

export function getLoopChainTranscript(chainId: string) {
  const id = sanitizeLoopChainId(chainId)
  if (!id) return null
  return loadLoopChainTranscript(id)
}

/** Solo tests: limpia runs activos. */
export function clearLoopChainRunsForTests(): void {
  stopAllLoopChainRuns()
}
