import { extractWikiIngest, type WikiIngestOp } from './wikiDoc'
import { stripBrainstormProtocolFences } from './brainstormRoom'

export interface BrainstormMessageParts {
  /** Lo que se lee como mensaje, ya sin cercas de protocolo. */
  prose: string
  /** Páginas de wiki que el turno escribió; vacío si no tocó ninguna. */
  wikiOps: WikiIngestOp[]
  /** Resumen que el propio turno dejó del cambio, si lo escribió. */
  wikiLog: string | null
}

/**
 * Parte un mensaje de sala en lo que se lee y lo que se hizo.
 *
 * El orden importa: `stripBrainstormProtocolFences` borra la cerca entera, así
 * que hay que sacarle las ops ANTES. Sin esto el turno que escribía en el wiki
 * o bien enseñaba el JSON crudo en la transcripción, o bien —tras taparlo—
 * dejaba el trabajo invisible: la página se creaba y nadie se enteraba.
 *
 * Solo describe lo que el turno escribió. Quién lo persiste es
 * `applyWikiIngestFromFinalText` en el pipeline del CLI, y esto no lo sabe: por
 * eso la tarjeta nombra las páginas y deja que se abran, en vez de afirmar que
 * están guardadas.
 */
export function splitBrainstormMessage(text: string): BrainstormMessageParts {
  if (typeof text !== 'string') return { prose: '', wikiOps: [], wikiLog: null }
  const { visibleText, ingest } = extractWikiIngest(text)
  return {
    prose: stripBrainstormProtocolFences(visibleText),
    wikiOps: ingest?.ops ?? [],
    wikiLog: ingest?.log ?? null,
  }
}
