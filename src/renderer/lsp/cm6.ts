// Cableado de CM6 para la navegación LSP. Todo hace no-op elegante cuando
// `host.doc()` es null (server bajando, arrancando, o archivo sin soporte).
import type { Extension } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import {
  EditorView,
  GutterMarker,
  gutter,
  hoverTooltip,
  keymap,
  showPanel,
  type Panel,
} from '@codemirror/view'
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import type { Completion, CompletionSource } from '@codemirror/autocomplete'
import type { LspCodeAction, LspCompletionItem, LspDiagnostic, LspLocation } from './client'
import { applyWorkspaceEdit, countFiles, type LspEdit, type WorkspaceEdit } from './edits'
import type { LspDoc } from './manager'
import { lspRangeToCm, lspToOffset, offsetToLsp, uriToPath } from './positions'

export interface LspHost {
  doc(): LspDoc | null
  /** Abre otro archivo del proyecto en la línea dada (go-to-definition, refs). */
  openFile(absPath: string, line: number): void
  /** uri del archivo abierto en ESTE editor, o null. */
  activeUri(): string | null
  /** Despacha `edits` (rangos en coordenadas LSP) como cambios de CM6. */
  applyToActiveView(edits: LspEdit[]): void
  /** Etiquetas ya traducidas; cm6 es DOM imperativo y no puede usar hooks. */
  labels: LspUiLabels
}

export interface LspUiLabels {
  referencesCount: (n: number) => string
  referencesMore: (n: number) => string
  close: string
  cancel: string
  apply: string
  renameTouchesFiles: (n: number) => string
}

export function lspExtensions(host: LspHost): Extension {
  return [
    definitionOnCmdClick(host),
    lspHover(host),
    referencesField,
    referencesPanelExt(host),
    lintGutter(),
    renameKeymap(host),
    lspDiagnosticsField,
    codeActionGutter(host),
  ]
}

// ─── Completado semántico ───────────────────────────────────────────────────

// CompletionItemKind de LSP → etiqueta corta de tipo para el ícono de CM6.
const KIND_LABEL: Record<number, string> = {
  2: 'method',
  3: 'function',
  5: 'property',
  6: 'variable',
  7: 'class',
  8: 'interface',
  9: 'module',
  14: 'keyword',
  21: 'constant',
}

const MAX_COMPLETION_ITEMS = 200

export function lspCompletionSource(host: LspHost): CompletionSource {
  return async ctx => {
    const doc = host.doc()
    if (!doc) return null
    // Dispara con caracteres de identificador o invocación explícita (Ctrl-Space).
    const word = ctx.matchBefore(/[\w:]+/)
    if (!ctx.explicit && !word) return null

    let items: LspCompletionItem[] = []
    try {
      items = await doc.client.completion(doc.uri, offsetToLsp(ctx.state.doc, ctx.pos))
    } catch {
      return null // timeout/error: silencioso, igual que definition/hover/references
    }
    if (!items.length) return null

    const options: Completion[] = items.slice(0, MAX_COMPLETION_ITEMS).map(it => ({
      label: it.label,
      detail: it.detail,
      type: it.kind ? KIND_LABEL[it.kind] : undefined,
      apply: it.textEdit
        ? (view: EditorView) => {
            const range = it.textEdit!.range
            const from = lspToOffset(view.state.doc, range.start)
            const to = lspToOffset(view.state.doc, range.end)
            view.dispatch({ changes: { from, to, insert: it.textEdit!.newText } })
          }
        : (it.insertText ?? it.label),
    }))
    return { from: word ? word.from : ctx.pos, options }
  }
}

// ─── Diagnósticos (subrayado + gutter) ──────────────────────────────────────

const SEVERITY_MAP: Record<number, CmDiagnostic['severity']> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'info',
}

/**
 * Método que el editor usa para empujar diagnósticos recién llegados a la vista.
 * `setDiagnostics` instala/actualiza el estado de lint; los marcadores del gutter
 * los dibuja `lintGutter()`. Además guardamos los `LspDiagnostic` CRUDOS (rangos,
 * severidad y source originales, antes de convertirlos a CmDiagnostic) en
 * `lspDiagnosticsField`: el gutter de code actions necesita esa forma original
 * para armar el `context` del request `textDocument/codeAction`, que el estado
 * propio de `@codemirror/lint` (severidades como string, mensaje ya prefijado con
 * el source) no puede reconstruir.
 */
export function applyLspDiagnostics(view: EditorView, diags: LspDiagnostic[]): void {
  const doc = view.state.doc
  const cm: CmDiagnostic[] = diags.map(d => {
    const { from, to } = lspRangeToCm(doc, d.range)
    return {
      from,
      // Los rangos de largo cero se ensanchan un carácter para que el subrayado
      // se vea; se recorta a doc.length para que un diagnóstico en EOF no se pase.
      to: Math.min(to > from ? to : from + 1, doc.length),
      severity: SEVERITY_MAP[d.severity ?? 1] ?? 'error',
      message: d.source ? `${d.source}: ${d.message}` : d.message,
    }
  })
  view.dispatch(setDiagnostics(view.state, cm), { effects: setLspDiagnostics.of(diags) })
}

// ─── Code actions (quick fixes) ─────────────────────────────────────────────

const setLspDiagnostics = StateEffect.define<LspDiagnostic[]>()

// Diagnósticos LSP crudos del documento actual. `applyLspDiagnostics` siempre se
// llama con diagnósticos ya filtrados al uri del doc activo (ver
// `LspDoc.onDiagnostics`), así que una sola lista plana alcanza.
const lspDiagnosticsField = StateField.define<LspDiagnostic[]>({
  create: () => [],
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setLspDiagnostics)) return e.value
    return value
  },
})

class LightbulbMarker extends GutterMarker {
  eq(): boolean {
    return true // un único marcador flyweight: idéntico donde aparezca
  }

  toDOM(): Node {
    const el = document.createElement('div')
    el.className = 'lsp-codeaction-lightbulb'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    const bulb = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    bulb.setAttribute('d', 'M8 1a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9z')
    bulb.setAttribute('fill', 'none')
    bulb.setAttribute('stroke', 'currentColor')
    bulb.setAttribute('stroke-width', '1.3')
    const base = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    base.setAttribute('d', 'M6 14h4M6.5 15.5h3')
    base.setAttribute('stroke', 'currentColor')
    base.setAttribute('stroke-width', '1.3')
    svg.append(bulb, base)
    el.appendChild(svg)
    return el
  }
}
const lightbulbMarker = new LightbulbMarker()

/** Diagnósticos de `lspDiagnosticsField` cuyo rango solapa la línea [from, to). */
function diagnosticsOnLine(view: EditorView, from: number, to: number): LspDiagnostic[] {
  const diags = view.state.field(lspDiagnosticsField, false) ?? []
  const doc = view.state.doc
  return diags.filter(d => {
    const r = lspRangeToCm(doc, d.range)
    return r.from <= to && r.to >= from
  })
}

// Bombita en el gutter: se dibuja en toda línea que hoy tenga un diagnóstico LSP.
// El click pide `textDocument/codeAction` para el rango + diagnósticos de esa
// línea y muestra un menú con los títulos devueltos.
function codeActionGutter(host: LspHost): Extension {
  return gutter({
    class: 'lsp-codeaction-gutter',
    lineMarker: (view, line) =>
      diagnosticsOnLine(view, line.from, line.to).length ? lightbulbMarker : null,
    lineMarkerChange: update =>
      update.state.field(lspDiagnosticsField) !== update.startState.field(lspDiagnosticsField),
    domEventHandlers: {
      click: (view, line, event) => {
        const diags = diagnosticsOnLine(view, line.from, line.to)
        if (!diags.length) return false
        void showCodeActions(view, host, line.from, line.to, diags, event as MouseEvent)
        return true
      },
    },
  })
}

async function showCodeActions(
  view: EditorView,
  host: LspHost,
  lineFrom: number,
  lineTo: number,
  diags: LspDiagnostic[],
  event: MouseEvent,
): Promise<void> {
  const doc = host.doc()
  if (!doc) return
  const range = {
    start: offsetToLsp(view.state.doc, lineFrom),
    end: offsetToLsp(view.state.doc, lineTo),
  }
  let actions: LspCodeAction[] = []
  try {
    actions = await doc.client.codeAction(doc.uri, range, diags)
  } catch {
    return // timeout/error: silencioso
  }
  if (!actions.length) return

  showFloatingMenu(
    event.clientX,
    event.clientY,
    actions.map(action => ({
      label: action.title,
      onSelect: () => void applyCodeAction(doc, host, action),
    })),
  )
}

async function applyCodeAction(doc: LspDoc, host: LspHost, action: LspCodeAction): Promise<void> {
  try {
    if (action.edit) await applyWorkspaceEdit(action.edit, editHost(host, doc))
    if (action.command) {
      await doc.client.executeCommand(action.command.command, action.command.arguments)
    }
  } catch (e) {
    console.warn('[lsp] code action falló', e)
  }
}

/**
 * Menú flotante mínimo para las code actions. Es DOM imperativo a propósito: lo
 * dispara un handler de gutter de CM6, fuera del árbol de React, y montar un
 * portal desde ahí costaría más que estas ~25 líneas.
 */
interface FloatingMenuItem {
  label: string
  onSelect: () => void
}

function showFloatingMenu(x: number, y: number, items: FloatingMenuItem[]): void {
  const menu = document.createElement('div')
  menu.className = 'lsp-menu'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`

  const close = (): void => {
    menu.remove()
    document.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('keydown', onKey, true)
  }
  const onOutside = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) close()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  for (const item of items) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'lsp-menu__item'
    row.textContent = item.label
    row.addEventListener('click', () => {
      close()
      item.onSelect()
    })
    menu.appendChild(row)
  }

  document.body.appendChild(menu)
  document.addEventListener('mousedown', onOutside, true)
  document.addEventListener('keydown', onKey, true)
}

// ─── Go to definition / references (mouse) ──────────────────────────────────

function definitionOnCmdClick(host: LspHost): Extension {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      if (!event.metaKey && !event.ctrlKey) return false
      const doc = host.doc()
      if (!doc) return false
      const offset = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (offset === null) return false
      const pos = offsetToLsp(view.state.doc, offset)
      if (event.altKey) void showReferences(view, doc, pos)
      else void jumpToDefinition(view, host, doc, pos)
      return true
    },
  })
}

async function jumpToDefinition(
  view: EditorView,
  host: LspHost,
  doc: LspDoc,
  pos: { line: number; character: number },
): Promise<void> {
  let locs: LspLocation[] = []
  try {
    locs = await doc.client.definition(doc.uri, pos)
  } catch {
    return
  }
  const target = locs[0]
  if (!target) return

  if (target.uri === doc.uri) {
    const offset = lspToOffset(view.state.doc, target.range.start)
    view.dispatch({
      selection: { anchor: offset },
      effects: EditorView.scrollIntoView(offset, { y: 'center' }),
    })
    view.focus()
  } else {
    host.openFile(uriToPath(target.uri), target.range.start.line + 1)
  }
}

// ─── Hover ──────────────────────────────────────────────────────────────────

const HOVER_DELAY_MS = 300

function lspHover(host: LspHost): Extension {
  return hoverTooltip(async (view, offset) => {
    const doc = host.doc()
    if (!doc) return null
    let text: string | null = null
    try {
      text = await doc.client.hover(doc.uri, offsetToLsp(view.state.doc, offset))
    } catch {
      return null
    }
    if (!text) return null

    const value = text
    return {
      pos: offset,
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'lsp-hover'
        // ponytail: el texto del hover sale de doc-comments de dependencias de
        // TERCEROS que el server indexa, no sólo de código del usuario.
        // Renderizarlo como markdown/HTML sería una superficie de XSS dentro de
        // un renderer con `window.api` colgando: se pinta como texto plano.
        dom.textContent = value
          .split('\n')
          .filter(line => !/^\s*```\w*\s*$/.test(line))
          .join('\n')
        return { dom }
      },
    }
  }, { hoverTime: HOVER_DELAY_MS })
}

// ─── Panel de referencias ───────────────────────────────────────────────────

const MAX_REFERENCES_SHOWN = 200

const setReferences = StateEffect.define<LspLocation[] | null>()

const referencesField = StateField.define<LspLocation[] | null>({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setReferences)) return e.value
    return value
  },
})

function referencesPanelExt(host: LspHost): Extension {
  return showPanel.from(referencesField, refs =>
    refs && refs.length ? view => referencesPanel(view, host, refs) : null)
}

async function showReferences(
  view: EditorView,
  doc: LspDoc,
  pos: { line: number; character: number },
): Promise<void> {
  let locs: LspLocation[] = []
  try {
    locs = await doc.client.references(doc.uri, pos)
  } catch {
    return
  }
  view.dispatch({ effects: setReferences.of(locs.length ? locs : null) })
}

function referencesPanel(view: EditorView, host: LspHost, refs: LspLocation[]): Panel {
  const dom = document.createElement('div')
  dom.className = 'lsp-references'

  const header = document.createElement('div')
  header.className = 'lsp-references__header'
  header.textContent = host.labels.referencesCount(refs.length)
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'lsp-references__close'
  close.textContent = '✕'
  close.setAttribute('aria-label', host.labels.close)
  close.addEventListener('click', () => view.dispatch({ effects: setReferences.of(null) }))
  header.appendChild(close)
  dom.appendChild(header)

  const list = document.createElement('div')
  list.className = 'lsp-references__list'
  const shown = refs.slice(0, MAX_REFERENCES_SHOWN)
  for (const ref of shown) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'lsp-references__row'
    const path = uriToPath(ref.uri)
    row.textContent = `${path.split('/').slice(-2).join('/')}:${ref.range.start.line + 1}`
    row.addEventListener('click', () => {
      host.openFile(path, ref.range.start.line + 1)
      view.dispatch({ effects: setReferences.of(null) })
    })
    list.appendChild(row)
  }
  if (refs.length > shown.length) {
    const more = document.createElement('div')
    more.className = 'lsp-references__row lsp-references__more'
    more.textContent = host.labels.referencesMore(refs.length - shown.length)
    list.appendChild(more)
  }
  dom.appendChild(list)
  return { dom }
}

// ─── Rename de símbolo (F2) ─────────────────────────────────────────────────

function renameKeymap(host: LspHost): Extension {
  return keymap.of([
    {
      key: 'F2',
      preventDefault: true,
      run: view => {
        void startRename(view, host)
        return true
      },
    },
  ])
}

// Palabra (identificador) que toca `pos` en su línea. CM6 no expone límites de
// palabra por lenguaje de forma genérica, así que es un escaneo `\w` a secas,
// igual que el regex del source de completado.
function wordRangeAt(
  view: EditorView,
  pos: number,
): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(pos)
  const text = line.text
  const offset = pos - line.from
  let start = offset
  while (start > 0 && /\w/.test(text[start - 1])) start--
  let end = offset
  while (end < text.length && /\w/.test(text[end])) end++
  if (start === end) return null
  return { from: line.from + start, to: line.from + end, text: text.slice(start, end) }
}

function editHost(host: LspHost, doc: LspDoc): {
  serverId: number
  activeUri: () => string | null
  applyToActiveView: (edits: LspEdit[]) => void
} {
  return {
    serverId: doc.serverId,
    activeUri: () => host.activeUri(),
    applyToActiveView: edits => host.applyToActiveView(edits),
  }
}

async function startRename(view: EditorView, host: LspHost): Promise<void> {
  const doc = host.doc()
  if (!doc) return
  const word = wordRangeAt(view, view.state.selection.main.head)
  if (!word) return
  const coords = view.coordsAtPos(word.from)
  if (!coords) return

  const box = document.createElement('div')
  box.className = 'lsp-rename'
  box.style.left = `${coords.left}px`
  box.style.top = `${coords.bottom + 4}px`

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'lsp-rename__input'
  input.value = word.text
  box.appendChild(input)
  document.body.appendChild(box)
  input.focus()
  input.select()

  const onOutsideClick = (e: MouseEvent): void => {
    if (!box.contains(e.target as Node)) cleanup()
  }
  const cleanup = (): void => {
    box.remove()
    document.removeEventListener('mousedown', onOutsideClick, true)
    view.focus()
  }
  document.addEventListener('mousedown', onOutsideClick, true)

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cleanup()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void commitRename(view, host, doc, word, input.value, box, cleanup)
    }
  })
}

async function commitRename(
  view: EditorView,
  host: LspHost,
  doc: LspDoc,
  word: { from: number; text: string },
  newName: string,
  box: HTMLDivElement,
  cleanup: () => void,
): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed || trimmed === word.text) {
    cleanup()
    return
  }

  let edit: WorkspaceEdit | null = null
  try {
    edit = await doc.client.rename(doc.uri, offsetToLsp(view.state.doc, word.from), trimmed)
  } catch {
    cleanup()
    return // timeout/error: silencioso
  }
  if (!edit) {
    cleanup()
    return
  }

  // Se estrecha a un const nuevo (en vez de `edit!` dentro del closure): el
  // null-check de arriba no sobrevive hasta la arrow function diferida.
  const resolvedEdit = edit
  const apply = async (): Promise<void> => {
    try {
      await applyWorkspaceEdit(resolvedEdit, editHost(host, doc))
    } catch (e) {
      console.warn('[lsp] rename falló', e)
    } finally {
      cleanup()
    }
  }

  const fileCount = countFiles(resolvedEdit)
  if (fileCount > 1) {
    showRenameConfirm(box, host.labels, fileCount, () => void apply(), cleanup)
    return
  }
  await apply()
}

function showRenameConfirm(
  box: HTMLDivElement,
  labels: LspUiLabels,
  fileCount: number,
  onApply: () => void,
  onCancel: () => void,
): void {
  box.textContent = ''
  const msg = document.createElement('div')
  msg.className = 'lsp-rename__confirm-msg'
  msg.textContent = labels.renameTouchesFiles(fileCount)
  box.appendChild(msg)

  const actions = document.createElement('div')
  actions.className = 'lsp-rename__confirm-actions'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.textContent = labels.cancel
  cancel.addEventListener('click', onCancel)
  const apply = document.createElement('button')
  apply.type = 'button'
  apply.textContent = labels.apply
  apply.addEventListener('click', onApply)
  actions.append(cancel, apply)
  box.appendChild(actions)
}
