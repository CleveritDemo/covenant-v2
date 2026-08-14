/** Eventos IPC de ejecución de cadenas de loop en main. Ver [[orchestration-fifo]]. */

export type LoopChainRunEndReason = 'stopped' | 'max' | 'error'

export type LoopChainEvent =
  | { type: 'run_start'; chainId: string }
  | { type: 'step_start'; chainId: string; cycle: number; stepIndex: number; agentId: string }
  | { type: 'step_delta'; chainId: string; cycle: number; stepIndex: number; agentId: string; text: string }
  | { type: 'step_final'; chainId: string; cycle: number; stepIndex: number; agentId: string; text: string }
  | { type: 'cycle_end'; chainId: string; cycle: number }
  | { type: 'run_end'; chainId: string; reason: LoopChainRunEndReason }
  | { type: 'error'; chainId: string; cycle?: number; stepIndex?: number; agentId?: string; message: string }

export type LoopChainRunStatus = 'running' | 'waiting' | 'stopped'

export interface LoopChainRunStateSnapshot {
  chainId: string
  status: LoopChainRunStatus
  cycle: number
  stepIndex: number
  activeAgentId?: string
  stopReason?: LoopChainRunEndReason
}

export interface LoopChainTranscriptEntry {
  cycle: number
  stepIndex: number
  agentId: string
  prompt: string
  text: string
  timestamp: string
  error?: string
}

export interface LoopChainTranscript {
  chainId: string
  entries: LoopChainTranscriptEntry[]
}

/** Valida chainId antes de armar rutas en userData (misma regla que threadIds). */
export function sanitizeLoopChainId(chainId: string): string | null {
  const trimmed = chainId.trim()
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed) || trimmed.includes('..')) return null
  return trimmed
}
