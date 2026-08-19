import type { AppConfig } from '../src/shared/configSchema'
import type { AgentCliStartRequest, AgentCliUiEvent } from '../src/shared/agentCliTypes'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import type { TabContext } from '../src/shared/tabContext'
import type { BrainstormSpeakerPhase } from '../src/shared/brainstormRoom'
import { runAgentCliSpawn, stopAgentRunsForPane, stopAgentRunsForPaneIdPrefix } from './agentCliRuntime'

export type HeadlessRunnerKind = 'brainstorm' | 'loop'

export interface HeadlessAgentTurnInput {
  runnerKind: HeadlessRunnerKind
  runnerId: string
  agent: ProjectAgentDefinition
  prompt: string
  cwd: string
  cliSessionId?: string
  /** Contextos del working set; el runtime ya sabe entregarlos (catálogo + need-sections). */
  contexts?: TabContext[]
  emitResults: boolean
  emitChangelog?: boolean
  isStale: () => boolean
  onDelta: (text: string) => void
  onSession?: (cliSessionId: string) => void
  /** Se llama una vez, con el primer evento del CLI: el proceso está vivo. */
  onPhase?: (phase: BrainstormSpeakerPhase) => void
}

export type HeadlessAgentTurnResult =
  | { ok: true; text: string }
  | { ok: false; aborted?: boolean; error?: string }

export function headlessRunKey(
  kind: HeadlessRunnerKind,
  runnerId: string,
  agentId: string,
): string {
  return `${kind}:${runnerId}:${agentId}`
}

/** Ejecuta un turno single-shot vía `runAgentCliSpawn` (brainstorm, loop, etc.). */
export function runHeadlessAgentTurn(
  input: HeadlessAgentTurnInput,
  config: AppConfig,
  home: string,
): Promise<HeadlessAgentTurnResult> {
  return new Promise(resolve => {
    if (input.isStale()) {
      resolve({ ok: false, aborted: true })
      return
    }

    let finalText = ''
    let lastError: string | undefined
    let settled = false
    let harnessOutageText: string | undefined
    let usedHarnessFallback = false
    // Cualquier primer evento sirve: significa que el proceso arrancó y ya está
    // masticando el contexto. Antes de esto no hay nada honesto que contar.
    let announcedAlive = false

    const settle = (result: HeadlessAgentTurnResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const request: AgentCliStartRequest = {
      paneId: headlessRunKey(input.runnerKind, input.runnerId, input.agent.id),
      provider: input.agent.provider,
      // Headless: auto (no plan) — camino más corto; sin tools ni delegación.
      permissionMode: 'auto',
      prompt: input.prompt,
      cwd: input.cwd,
      name: input.agent.name,
      role: input.agent.role,
      objective: input.agent.objective,
      rules: input.agent.rules,
      model: input.agent.model,
      agentId: input.agent.id,
      cliSessionId: input.cliSessionId,
      coordination: 'none',
      allowDelegations: false,
      emitResults: input.emitResults,
      emitChangelog: input.emitChangelog,
      // Hereda skills y MCP del agente: sin esto el turno arranca sin
      // su `.mcp.json` acotado y sin el preámbulo, y el modelo dice que no
      // tiene Jira.
      nativeSkills: input.agent.nativeSkills,
      mcpsAllowed: input.agent.mcpsAllowed ?? [],
      contexts: input.contexts ?? [],
      ...(input.agent.fallbackProvider
        ? {
            fallbackProvider: input.agent.fallbackProvider,
            ...(input.agent.fallbackModel ? { fallbackModel: input.agent.fallbackModel } : {}),
          }
        : {}),
    }

    runAgentCliSpawn(request, config, home, {
      onEvent: (event: AgentCliUiEvent) => {
        if (input.isStale()) return
        if (!announcedAlive) {
          announcedAlive = true
          input.onPhase?.('reading')
        }
        if (event.type === 'session') {
          input.onSession?.(event.cliSessionId)
          return
        }
        if (event.type === 'assistant_delta') {
          input.onDelta(event.text)
          return
        }
        if (event.type === 'assistant_final') {
          finalText = event.text
          return
        }
        if (event.type === 'error') {
          lastError = event.message
          return
        }
        if (event.type === 'harness_fallback') {
          usedHarnessFallback = true
          return
        }
        if (event.type === 'harness_outage') {
          harnessOutageText = event.text
          lastError = event.text
          return
        }
      },
      onDone: code => {
        if (input.isStale()) {
          settle({ ok: false, aborted: true })
          return
        }
        if (harnessOutageText && !usedHarnessFallback) {
          settle({ ok: false, error: harnessOutageText })
          return
        }
        if (code !== 0 && !finalText.trim()) {
          settle({
            ok: false,
            error: lastError || `El CLI terminó con código ${code}.`,
          })
          return
        }
        settle({ ok: true, text: finalText })
      },
    })
  })
}

export function stopHeadlessAgentRuns(
  kind: HeadlessRunnerKind,
  runnerId: string,
  agentId?: string,
): void {
  const trimmedRunner = runnerId.trim()
  if (!trimmedRunner) return
  if (agentId?.trim()) {
    stopAgentRunsForPane(headlessRunKey(kind, trimmedRunner, agentId.trim()))
    return
  }
  stopAgentRunsForPaneIdPrefix(`${kind}:${trimmedRunner}:`)
}
