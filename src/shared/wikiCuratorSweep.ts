/**
 * Contrato puro del barrido de wiki: pases, eventos IPC y prompts por pase.
 * Sin fs ni Electron — electron/wikiCuratorSweep.ts corre la secuencia.
 */

import {
  buildWikiCuratorPrompt,
  type WikiCuratorConfig,
} from './wikiCurator'

export const MAX_WIKI_SWEEP_INGEST_OPS = 24

export type WikiSweepPass = 'health' | 'truth' | 'coverage' | 'shape' | 'closing'

export const WIKI_SWEEP_PASSES: readonly WikiSweepPass[] = [
  'health',
  'truth',
  'coverage',
  'shape',
  'closing',
] as const

export const WIKI_SWEEP_TOTAL = WIKI_SWEEP_PASSES.length

export function wikiSweepPassLabelKey(
  pass: WikiSweepPass,
): 'tabs.wikiSweepPassHealth'
  | 'tabs.wikiSweepPassTruth'
  | 'tabs.wikiSweepPassCoverage'
  | 'tabs.wikiSweepPassShape'
  | 'tabs.wikiSweepPassClosing' {
  if (pass === 'truth') return 'tabs.wikiSweepPassTruth'
  if (pass === 'coverage') return 'tabs.wikiSweepPassCoverage'
  if (pass === 'shape') return 'tabs.wikiSweepPassShape'
  if (pass === 'closing') return 'tabs.wikiSweepPassClosing'
  return 'tabs.wikiSweepPassHealth'
}

export type WikiSweepEvent =
  | { type: 'pass_start'; pass: WikiSweepPass; index: number; total: number }
  | { type: 'delta'; pass: WikiSweepPass; text: string }
  | { type: 'pass_done'; pass: WikiSweepPass; opsApplied: number }
  | { type: 'error'; message: string }
  | { type: 'done'; totalOps: number; snapshotPath: string | null; stopped: boolean }

const SWEEP_PASS_OBJECTIVES: Record<WikiSweepPass, string> = {
  health:
    'Fix every item listed in Wiki health: orphan pages (link them from a relevant page, or delete if worthless), broken [[links]] (repoint or remove), dead file paths (correct or drop the claim). Do NOT create new subject pages in this pass.',
  truth:
    'Read the real code behind the claims made by existing pages and correct every stale or false statement. Prioritize pages about orchestration, delegation, composer and wiki. DELETE pages whose subject no longer exists in the code.',
  coverage:
    'Find subsystems, flows and decisions in the repo with no wiki page and create them, following the Init coverage catalog. Do NOT rewrite pages that are already correct.',
  shape:
    'Enforce page shape: one job per page, correct type, real file paths, dense [[links]], no long prose. Split pages doing two jobs, merge duplicates, fix titles.',
  closing:
    'Emit one consolidated log line summarizing the whole sweep, and fix any [[link]] broken by this sweep\'s own deletes. Create no new pages.',
}

/** Prompt de un pase: init del curador + bloque Sweep pass con objetivo fijo del pase. */
export function buildWikiSweepPassPrompt(
  pass: WikiSweepPass,
  config: WikiCuratorConfig,
  healthSection: string | undefined,
  index: number,
  total: number,
): string {
  const objective = SWEEP_PASS_OBJECTIVES[pass]
  const base = buildWikiCuratorPrompt(config, objective, healthSection, 'init')
  const header = [
    '## Sweep pass',
    `Pass ${index}/${total}: ${pass}`,
    '',
  ].join('\n')
  return `${header}${base}`
}
