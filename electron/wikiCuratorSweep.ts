/**
 * Barrido completo de la wiki: snapshot previo, cinco pases secuenciales del
 * curador con ingest por pase y eventos IPC hacia el renderer.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type { AgentCliStartRequest, AgentCliUiEvent } from '../src/shared/agentCliTypes'
import {
  buildWikiSweepPassPrompt,
  MAX_WIKI_SWEEP_INGEST_OPS,
  WIKI_SWEEP_PASSES,
  type WikiSweepEvent,
  type WikiSweepPass,
} from '../src/shared/wikiCuratorSweep'
import { INDEX_FILE, LOG_FILE, PAGES_DIR } from '../src/shared/wikiDoc'
import { IPC } from '../src/shared/ipcChannels'
import { discoverTabContexts } from './tabContextBuild'
import { runAgentCliSpawn, stopAgentRunsForPane } from './agentCliRuntime'
import { applyWikiIngestFromFinalText } from './wikiIngest'
import { ensureWiki, wikiRootPath } from './wikiStore'
import { buildWikiHealthSection } from './wikiHealth'
import {
  sanitizeWikiCuratorConfig,
} from '../src/shared/wikiCurator'
import { type WikiCuratorRunner } from './wikiCurator'
import { isWikiCuratorActive } from './wikiCuratorActive'

const CURATOR_AGENT_ID = 'wiki-curator'
const SNAPSHOTS_DIR = '.snapshots'
const MAX_SNAPSHOTS = 3

interface SweepRunState {
  generation: number
  stopRequested: boolean
  resolveCurrentPass?: (r: { code: number; finalText: string }) => void
}

const sweepRuns = new Map<string, SweepRunState>()
let nextSweepGeneration = 1

export function wikiSweepPaneId(cwd: string): string {
  return `wiki-sweep:${cwd}`
}

function emitSweep(win: BrowserWindow, cwd: string, event: WikiSweepEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC.WIKI_SWEEP_EVENT, cwd, event)
  }
}

function pruneOldSnapshots(wikiRoot: string): void {
  const snapshotsRoot = join(wikiRoot, SNAPSHOTS_DIR)
  if (!existsSync(snapshotsRoot)) return
  const entries = readdirSync(snapshotsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({ name: entry.name, ts: Number(entry.name) }))
    .filter(entry => Number.isFinite(entry.ts))
    .sort((a, b) => b.ts - a.ts)
  for (const entry of entries.slice(MAX_SNAPSHOTS)) {
    try {
      rmSync(join(snapshotsRoot, entry.name), { recursive: true, force: true })
    } catch { /* best-effort */ }
  }
}

/** Copia pages/, index.md y log.md a `.gravity/wiki/.snapshots/<ts>/`. */
function snapshotWiki(cwd: string): string {
  const wikiRoot = wikiRootPath(cwd)
  const snapshotDir = join(wikiRoot, SNAPSHOTS_DIR, String(Date.now()))
  mkdirSync(snapshotDir, { recursive: true })

  const pagesSrc = join(wikiRoot, PAGES_DIR)
  if (existsSync(pagesSrc)) {
    cpSync(pagesSrc, join(snapshotDir, PAGES_DIR), { recursive: true })
  }
  const indexSrc = join(wikiRoot, INDEX_FILE)
  if (existsSync(indexSrc)) {
    cpSync(indexSrc, join(snapshotDir, INDEX_FILE))
  }
  const logSrc = join(wikiRoot, LOG_FILE)
  if (existsSync(logSrc)) {
    cpSync(logSrc, join(snapshotDir, LOG_FILE))
  }

  pruneOldSnapshots(wikiRoot)
  return snapshotDir
}

function buildSweepContexts(cwd: string): AgentCliStartRequest['contexts'] {
  const discovered = discoverTabContexts(cwd).contexts
  let contexts = discovered.filter(item => item.kind === 'wiki' || item.kind === 'folderTree')
  if (!contexts.some(item => item.kind === 'folderTree')) {
    contexts = [
      ...contexts,
      {
        id: 'iaterminal:folderTree:init',
        name: 'Project folders',
        fileName: 'folders.md',
        kind: 'folderTree',
      },
    ]
  }
  return contexts
}

function runSweepPass(
  run: SweepRunState,
  request: AgentCliStartRequest,
  appConfig: AppConfig,
  home: string,
  runner: WikiCuratorRunner,
  isStale: () => boolean,
  onDelta: (text: string) => void,
): Promise<{ code: number; finalText: string; error?: string; cliSessionId?: string }> {
  return new Promise(resolve => {
    let finalText = ''
    let lastError: string | undefined
    let cliSessionId: string | undefined
    let resolved = false

    const finishPass = (result: {
      code: number
      finalText: string
      error?: string
      cliSessionId?: string
    }): void => {
      if (resolved) return
      resolved = true
      run.resolveCurrentPass = undefined
      resolve(result)
    }

    run.resolveCurrentPass = ({ code, finalText: text }) => {
      finishPass({ code, finalText: text, error: lastError, cliSessionId })
    }

    runner(request, appConfig, home, {
      onEvent: (event: AgentCliUiEvent) => {
        if (isStale()) return
        if (event.type === 'session') {
          cliSessionId = event.cliSessionId
          return
        }
        if (event.type === 'assistant_delta') {
          onDelta(event.text)
          return
        }
        if (event.type === 'assistant_final') {
          finalText = event.text
          return
        }
        if (event.type === 'error') {
          lastError = event.message
        }
      },
      onDone: code => {
        finishPass({ code, finalText, error: lastError, cliSessionId })
      },
    })
  })
}

async function runWikiSweepSequence(
  win: BrowserWindow,
  cwd: string,
  appConfig: AppConfig,
  home: string,
  run: SweepRunState,
  runner: WikiCuratorRunner,
): Promise<void> {
  const isStale = (): boolean => sweepRuns.get(cwd)?.generation !== run.generation
  const isStopped = (): boolean => run.stopRequested || isStale()

  let snapshotPath: string | null = null
  let totalOps = 0
  let cliSessionId: string | undefined
  let doneEmitted = false

  const finish = (stopped: boolean): void => {
    if (doneEmitted) return
    doneEmitted = true
    emitSweep(win, cwd, { type: 'done', totalOps, snapshotPath, stopped })
    if (sweepRuns.get(cwd)?.generation === run.generation) {
      sweepRuns.delete(cwd)
    }
  }

  try {
    ensureWiki(cwd)
    snapshotPath = snapshotWiki(cwd)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitSweep(win, cwd, { type: 'error', message })
    finish(false)
    return
  }

  const curatorConfig = sanitizeWikiCuratorConfig(appConfig.wikiCurator)
  const contexts = buildSweepContexts(cwd)
  const paneId = wikiSweepPaneId(cwd)
  const total = WIKI_SWEEP_PASSES.length

  try {
    for (let i = 0; i < WIKI_SWEEP_PASSES.length; i++) {
      if (isStopped()) break

      const pass = WIKI_SWEEP_PASSES[i]!
      const index = i + 1
      emitSweep(win, cwd, { type: 'pass_start', pass, index, total })

      const healthSection = buildWikiHealthSection(cwd)
      const request: AgentCliStartRequest = {
        paneId,
        provider: curatorConfig.provider ?? 'claude',
        permissionMode: 'plan',
        prompt: buildWikiSweepPassPrompt(pass, curatorConfig, healthSection, index, total),
        cwd,
        name: curatorConfig.name,
        model: curatorConfig.model,
        agentId: CURATOR_AGENT_ID,
        coordination: 'none',
        allowDelegations: false,
        emitResults: false,
        emitChangelog: false,
        mcpsAllowed: [],
        contexts,
        ...(cliSessionId ? { cliSessionId } : {}),
      }

      const result = await runSweepPass(
        run,
        request,
        appConfig,
        home,
        runner,
        isStale,
        text => {
          if (!isStopped()) {
            emitSweep(win, cwd, { type: 'delta', pass, text })
          }
        },
      )

      if (result.cliSessionId) {
        cliSessionId = result.cliSessionId
      }

      if (isStopped()) break

      if (result.code !== 0 && !result.finalText.trim()) {
        emitSweep(win, cwd, {
          type: 'error',
          message: result.error || `El CLI terminó con código ${result.code}.`,
        })
        break
      }

      const ingest = applyWikiIngestFromFinalText(result.finalText, cwd, {
        agentId: CURATOR_AGENT_ID,
        persist: true,
        maxOps: MAX_WIKI_SWEEP_INGEST_OPS,
      })
      const opsApplied = ingest.persisted ? ingest.applied : 0
      totalOps += opsApplied
      emitSweep(win, cwd, { type: 'pass_done', pass, opsApplied, errors: ingest.errors })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitSweep(win, cwd, { type: 'error', message })
  } finally {
    finish(run.stopRequested || isStale())
  }
}

export function isWikiSweepRunning(cwd: string): boolean {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : ''
  return trimmed ? sweepRuns.has(trimmed) : false
}

export function isWikiSweepBlocked(cwd: string): boolean {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : ''
  if (!trimmed) return false
  return isWikiSweepRunning(trimmed) || isWikiCuratorActive(trimmed)
}

export function startWikiSweep(
  win: BrowserWindow,
  cwd: string,
  appConfig: AppConfig,
  home: string,
  options?: { runner?: WikiCuratorRunner },
): { ok: true } | { ok: false; error: string } {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : ''
  if (!trimmed) return { ok: false, error: 'cwd inválido' }
  if (isWikiSweepRunning(trimmed)) {
    return { ok: false, error: 'Ya hay un barrido de wiki en curso para este proyecto.' }
  }
  if (isWikiCuratorActive(trimmed)) {
    return { ok: false, error: 'Hay un turno del curador en curso.' }
  }

  const generation = nextSweepGeneration++
  const run: SweepRunState = { generation, stopRequested: false }
  sweepRuns.set(trimmed, run)

  const runner = options?.runner ?? runAgentCliSpawn
  runWikiSweepSequence(win, trimmed, appConfig, home, run, runner).catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    emitSweep(win, trimmed, { type: 'error', message })
    emitSweep(win, trimmed, { type: 'done', totalOps: 0, snapshotPath: null, stopped: false })
    if (sweepRuns.get(trimmed)?.generation === run.generation) {
      sweepRuns.delete(trimmed)
    }
  })

  return { ok: true }
}

export function stopWikiSweep(cwd: string, win?: BrowserWindow): void {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : ''
  if (!trimmed) return
  const run = sweepRuns.get(trimmed)
  if (!run) return
  run.stopRequested = true
  if (win) {
    stopAgentRunsForPane(wikiSweepPaneId(trimmed), { notify: true, win })
  } else {
    stopAgentRunsForPane(wikiSweepPaneId(trimmed))
  }
  run.resolveCurrentPass?.({ code: 130, finalText: '' })
}

/** Solo tests: limpia estado de barridos activos. */
export function clearWikiSweepForTests(): void {
  sweepRuns.clear()
}
