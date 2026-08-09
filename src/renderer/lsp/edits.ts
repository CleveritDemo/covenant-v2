// Aplicador de WorkspaceEdit — lo usan rename y code actions. Dos caminos: el
// archivo del editor activo va por `dispatch` de CM6 (vía `host`) para que el
// undo siga andando y el buffer siga siendo la verdad; cualquier otro archivo se
// lee y escribe en disco por IPC, confinado a la raíz del workspace que calculó
// el main (`lspReadFile`/`lspWriteFile` validan contra ella).
import type { LspPosition } from './positions'
import { uriToPath } from './positions'

export interface LspEdit {
  range: { start: LspPosition; end: LspPosition }
  newText: string
}

/**
 * Los servers pueden devolver `changes` (uri → edits, lo común) o
 * `documentChanges` (array de `{textDocument, edits}`, cuando los edits necesitan
 * versionado u operaciones de archivo). No nos hacen falta las operaciones de
 * crear/renombrar/borrar que `documentChanges` también puede traer —sólo edits de
 * texto—, así que aplanamos la forma que haya llegado a listas de edits por uri.
 */
export interface WorkspaceEdit {
  changes?: Record<string, LspEdit[]>
  documentChanges?: Array<{ textDocument: { uri: string }; edits: LspEdit[] }>
}

export interface WorkspaceEditHost {
  /** Server dueño de este edit; la IPC valida las rutas contra SU raíz. */
  serverId: number
  /** uri del archivo abierto en el editor activo, o null. */
  activeUri(): string | null
  /**
   * Despacha `edits` (en coordenadas LSP del documento original) como cambios de
   * CM6 sobre la vista activa. El host es dueño del `Text` vivo, así que hace él
   * el mapeo LSP→offset.
   */
  applyToActiveView(edits: LspEdit[]): void
}

/**
 * Splice puro: ordena los edits por posición de inicio DESCENDENTE y los aplica
 * en ese orden, así un splice anterior (de menor offset) nunca invalida los
 * índices ya calculados para uno posterior — el mismo principio de orden que el
 * `didChange` incremental.
 */
export function applyTextEdits(text: string, edits: LspEdit[]): string {
  if (!edits.length) return text
  const lineStarts = lineStartOffsets(text)
  const spans = edits
    .map(e => ({
      from: posToStringOffset(lineStarts, text.length, e.range.start),
      to: posToStringOffset(lineStarts, text.length, e.range.end),
      newText: e.newText,
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to)
  let result = text
  for (const { from, to, newText } of spans) {
    result = result.slice(0, from) + newText + result.slice(to)
  }
  return result
}

function lineStartOffsets(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1)
  }
  return starts
}

// Espejo de `lspToOffset` (positions.ts) pero contra un string plano en vez de un
// `Text` de CM6: los archivos no activos son strings leídos de disco.
function posToStringOffset(lineStarts: number[], textLength: number, pos: LspPosition): number {
  if (pos.line >= lineStarts.length) return textLength
  const line = Math.max(0, pos.line)
  const lineStart = lineStarts[line]
  const lineEnd = line + 1 < lineStarts.length ? lineStarts[line + 1] - 1 : textLength
  return Math.min(lineStart + Math.max(0, pos.character), lineEnd)
}

export function editsByUri(edit: WorkspaceEdit): Record<string, LspEdit[]> {
  if (edit.changes) return edit.changes
  if (edit.documentChanges) {
    const byUri: Record<string, LspEdit[]> = {}
    for (const dc of edit.documentChanges) {
      byUri[dc.textDocument.uri] = [...(byUri[dc.textDocument.uri] ?? []), ...dc.edits]
    }
    return byUri
  }
  return {}
}

/**
 * Cuántos archivos toca un WorkspaceEdit (uris con al menos un edit). Lo comparten
 * el contador del diálogo de confirmación (cm6.ts) y `applyWorkspaceEdit`, así no
 * pueden divergir.
 */
export function countFiles(edit: WorkspaceEdit): number {
  return Object.values(editsByUri(edit)).filter(edits => edits.length > 0).length
}

/**
 * Aplica un WorkspaceEdit sobre los archivos que toque. El uri del editor activo
 * va por `host` (cambios de CM6, undo intacto); el resto se parchea en disco.
 * Devuelve los conteos para la UI de confirmación.
 *
 * Orden: los archivos en disco se leen/escriben ANTES de tocar la vista activa.
 * La IPC puede fallar (ruta fuera del workspace, permisos), y hacer primero todo
 * el disco significa que un fallo aborta el rename entero antes de tocar el
 * buffer vivo de CM6, que acá no tiene rollback.
 *
 * ponytail: sin rollback cross-file — un fallo a mitad deja editados los archivos
 * anteriores; el throw se propaga y la UI lo muestra. Transaccionalidad completa
 * si algún día duele de verdad.
 */
export async function applyWorkspaceEdit(
  edit: WorkspaceEdit,
  host: WorkspaceEditHost,
): Promise<{ files: number; edits: number }> {
  const byUri = editsByUri(edit)
  const activeUri = host.activeUri()
  const files = countFiles(edit)
  let editCount = 0
  let activeEdits: LspEdit[] | null = null

  for (const [uri, uriEdits] of Object.entries(byUri)) {
    if (!uriEdits.length) continue
    editCount += uriEdits.length
    if (uri === activeUri) {
      activeEdits = uriEdits
      continue
    }
    const path = uriToPath(uri)
    const read = await window.api.lspReadFile(host.serverId, path)
    if (!read.ok || read.content == null) {
      throw new Error(`no se pudo leer ${path}: ${read.error ?? 'desconocido'}`)
    }
    const written = await window.api.lspWriteFile(
      host.serverId,
      path,
      applyTextEdits(read.content, uriEdits),
    )
    if (!written.ok) {
      throw new Error(`no se pudo escribir ${path}: ${written.error ?? 'desconocido'}`)
    }
  }

  if (activeEdits) host.applyToActiveView(activeEdits)
  return { files, edits: editCount }
}
