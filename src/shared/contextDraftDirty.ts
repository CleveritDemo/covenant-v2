import type { TabContext } from './tabContext'

/**
 * Entrada de `isContextDraftDirty`. Son todos datos planos —nada de React ni
 * de fs— para poder testear el cálculo como función pura y reusarlo tanto en
 * el render (el aviso del pie del modal) como en el handler de Esc/backdrop,
 * que corre fuera del render y por eso lee el resultado a través de un ref.
 */
export interface ContextDraftDirtyInput {
  /** Contexto en edición; `null` si el modal está cerrado. */
  draft: TabContext | null
  /** Contexto con el que se abrió el modal en `edit`; `null` en `create`. */
  initial: TabContext | null
  /** Cuerpo actual del textarea de `notes` (vive fuera de `draft`). */
  notesContent: string
  /** Cuerpo de `notes` con el que se abrió el modal (o `''` en `create`). */
  initialNotesContent: string
  /**
   * `agentResult`: el modal no ofrece guardar (el pie oculta el botón), así que
   * no hay nada que perder al cerrar. Un `changelog` **no** entra aquí: su
   * nombre sí es editable y guardable, y renombrarlo tiene que ensuciar el
   * draft como cualquier otro cambio.
   */
  readOnly: boolean
}

/**
 * `true` si cerrar el modal de contextos ahora perdería algo que el usuario
 * escribió. Comparación por valor (no por referencia) contra el contexto de
 * partida: en `create` cualquier nombre escrito ya cuenta como cambio
 * pendiente. El cuerpo de `notes` se compara aparte de `draft` porque no vive
 * ahí, y se compara contra el valor cargado al abrir (no solo "no está
 * vacío"), para no dejar sin aviso la edición del cuerpo de una nota ya
 * existente. Solo `agentResult` (ver `readOnly`) nunca está "sucio".
 */
export function isContextDraftDirty(input: ContextDraftDirtyInput): boolean {
  const { draft, initial, notesContent, initialNotesContent, readOnly } = input
  if (!draft || readOnly) return false
  const metadataDirty = initial
    ? JSON.stringify(draft) !== JSON.stringify(initial)
    : Boolean((draft.name ?? '').trim())
  const notesDirty = draft.kind === 'notes' && notesContent.trim() !== initialNotesContent.trim()
  return metadataDirty || notesDirty
}
