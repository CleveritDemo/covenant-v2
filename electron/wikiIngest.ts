import { extractWikiIngest, type WikiIngestOp } from '../src/shared/wikiDoc'
import { applyWikiIngest } from './wikiStore'

export interface WikiIngestFromFinalTextResult {
  visibleText: string
  applied: number
  errors: string[]
  /** true si hubo ingest y persist true y se escribió vía applyWikiIngest. */
  persisted: boolean
}

/** Summary de log derivado de las ops: 'upsert a, b; delete c'. */
function summarizeWikiOps(ops: readonly WikiIngestOp[]): string {
  const upserts = ops.filter(op => op.op === 'upsert').map(op => op.slug)
  const deletes = ops.filter(op => op.op === 'delete').map(op => op.slug)
  const parts: string[] = []
  if (upserts.length) parts.push(`upsert ${upserts.join(', ')}`)
  if (deletes.length) parts.push(`delete ${deletes.join(', ')}`)
  return parts.join('; ')
}

/**
 * Extrae el fence ```ia-terminal-wiki``` del assistant_final y lo aplica al
 * store cuando persist es true. Con persist false solo limpia el fence del
 * texto visible (nunca se muestra crudo) y no escribe nada. Si el ingest no
 * trae log, se autogenera desde las ops; el store le agrega timestamp ISO y
 * agentId con formatWikiLogEntry. A diferencia de las anotaciones, el ingest
 * NO se filtra por changedPaths: captura decisiones y significado, no diffs.
 */
export function applyWikiIngestFromFinalText(
  finalText: string,
  cwd: string,
  options: { agentId?: string; persist: boolean; maxOps?: number },
): WikiIngestFromFinalTextResult {
  const { visibleText, ingest } = extractWikiIngest(finalText, options.maxOps)
  if (!ingest || !options.persist) {
    return { visibleText, applied: 0, errors: [], persisted: false }
  }
  const log = ingest.log ?? (ingest.ops.length ? summarizeWikiOps(ingest.ops) : null)
  const result = applyWikiIngest(cwd, { ops: ingest.ops, log }, { agentId: options.agentId })
  return { visibleText, applied: result.applied, errors: result.errors, persisted: true }
}
