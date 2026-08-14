import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import {
  sanitizeLoopChainId,
  type LoopChainTranscript,
  type LoopChainTranscriptEntry,
} from '../src/shared/loopChainEvents'

const LOOP_RUNS_DIR = (): string => join(app.getPath('userData'), 'loop-runs')

function transcriptPath(chainId: string): string {
  const safe = sanitizeLoopChainId(chainId)
  if (!safe) throw new Error(`chainId inválido: ${chainId}`)
  return join(LOOP_RUNS_DIR(), `${safe}.json`)
}

function ensureDir(): void {
  mkdirSync(LOOP_RUNS_DIR(), { recursive: true })
}

export function loadLoopChainTranscript(chainId: string): LoopChainTranscript | null {
  try {
    const path = transcriptPath(chainId)
    if (!existsSync(path)) return null
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<LoopChainTranscript>
    if (!parsed || typeof parsed.chainId !== 'string' || !Array.isArray(parsed.entries)) return null
    return {
      chainId: parsed.chainId,
      entries: parsed.entries.filter(isTranscriptEntry),
    }
  } catch {
    return null
  }
}

function isTranscriptEntry(value: unknown): value is LoopChainTranscriptEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.cycle === 'number'
    && typeof item.stepIndex === 'number'
    && typeof item.agentId === 'string'
    && typeof item.prompt === 'string'
    && typeof item.text === 'string'
    && typeof item.timestamp === 'string'
  )
}

export function appendLoopChainTranscriptEntry(
  chainId: string,
  entry: LoopChainTranscriptEntry,
): void {
  const safe = sanitizeLoopChainId(chainId)
  if (!safe) return
  ensureDir()
  const existing = loadLoopChainTranscript(safe)
  const transcript: LoopChainTranscript = existing ?? { chainId: safe, entries: [] }
  transcript.entries.push(entry)
  writeFileSync(transcriptPath(safe), JSON.stringify(transcript), 'utf-8')
}

/** Solo tests: borra transcripts en memoria de disco temporal. */
export function resetLoopChainTranscriptForTests(chainId: string): void {
  try {
    const path = transcriptPath(chainId)
    if (existsSync(path)) unlinkSync(path)
  } catch {
    /* ignore */
  }
}
