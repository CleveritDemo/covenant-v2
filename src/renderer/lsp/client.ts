// Cliente LSP mínimo: correlación JSON-RPC y los métodos que el editor usa.
// A propósito no es `codemirror-languageserver`: ese paquete no trae
// definition/references, que son justamente la mitad del valor.
import type { LspPosition } from './positions'
import type { WorkspaceEdit } from './edits'

export interface Transport {
  send(message: string): void
  onMessage(cb: (message: string) => void): void
  dispose(): void
}

export interface LspLocation {
  uri: string
  range: { start: LspPosition; end: LspPosition }
}

export interface LspDiagnostic {
  range: { start: LspPosition; end: LspPosition }
  severity?: 1 | 2 | 3 | 4
  message: string
  source?: string
}

export interface LspContentChange {
  range?: { start: LspPosition; end: LspPosition }
  text: string
}

export interface LspCommand {
  command: string
  arguments?: unknown[]
}

export interface LspCodeAction {
  title: string
  edit?: WorkspaceEdit
  command?: LspCommand
}

export interface LspCompletionItem {
  label: string
  kind?: number
  detail?: string
  documentation?: string | { value: string }
  insertText?: string
  textEdit?: { range: { start: LspPosition; end: LspPosition }; newText: string }
  sortText?: string
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const REQUEST_TIMEOUT_MS = 10_000

export class LspClient {
  private nextId = 1
  private pending = new Map<number, Pending>()
  private versions = new Map<string, number>()
  private disposed = false
  private diagnosticsSubs = new Set<(uri: string, diags: LspDiagnostic[]) => void>()

  constructor(private readonly transport: Transport) {
    transport.onMessage(raw => this.handleMessage(raw))
  }

  async initialize(rootUri: string): Promise<void> {
    await this.request('initialize', {
      processId: null,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: rootUri.split('/').pop() ?? 'root' }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
          references: {},
          synchronization: { didSave: true },
          completion: { completionItem: { snippetSupport: false } },
          rename: { prepareSupport: false },
          codeAction: {},
        },
      },
    })
    this.notify('initialized', {})
  }

  didOpen(uri: string, languageId: string, text: string): void {
    this.versions.set(uri, 1)
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    })
  }

  /**
   * Handshake post-initialize de Roslyn (csharp) cuando el workspace tiene un
   * `.sln`/`.slnx`: sin esto las definiciones cross-file nunca resuelven. Los
   * params son un `{ solution: <uri> }` PLANO, no anidado. El manager lo manda
   * una vez por server, después de que `initialize` resuelve y antes del primer
   * `didOpen`.
   */
  openSolution(solutionUri: string): void {
    this.notify('solution/open', { solution: solutionUri })
  }

  /**
   * Handshake post-initialize de Roslyn cuando sólo hay `.csproj` (sin `.sln`):
   * `solution/open` espera un archivo de solución de verdad y para un `.csproj`
   * pelado no carga nada. Los params son un array plano de URIs STRING —
   * `{ projects: [<uri>] }` — no objetos con un campo `uri`.
   */
  openProject(projectUri: string): void {
    this.notify('project/open', { projects: [projectUri] })
  }

  /**
   * ponytail: reenviamos `changes` tal cual venga, con la granularidad que armó
   * quien llama — una sola entrada `{text}` sin `range` es un reemplazo total,
   * y con `range` son deltas incrementales. Esa decisión es de `LspDoc`.
   */
  didChange(uri: string, changes: LspContentChange[]): void {
    const version = (this.versions.get(uri) ?? 1) + 1
    this.versions.set(uri, version)
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: changes,
    })
  }

  didClose(uri: string): void {
    this.versions.delete(uri)
    this.notify('textDocument/didClose', { textDocument: { uri } })
  }

  async definition(uri: string, pos: LspPosition): Promise<LspLocation[]> {
    const r = await this.request('textDocument/definition', {
      textDocument: { uri },
      position: pos,
    })
    return normalizeLocations(r)
  }

  async hover(uri: string, pos: LspPosition): Promise<string | null> {
    const r = (await this.request('textDocument/hover', {
      textDocument: { uri },
      position: pos,
    })) as { contents?: unknown } | null
    if (!r?.contents) return null
    return markupToString(r.contents)
  }

  async references(uri: string, pos: LspPosition): Promise<LspLocation[]> {
    const r = await this.request('textDocument/references', {
      textDocument: { uri },
      position: pos,
      context: { includeDeclaration: true },
    })
    return normalizeLocations(r)
  }

  async completion(uri: string, pos: LspPosition): Promise<LspCompletionItem[]> {
    const r = (await this.request('textDocument/completion', {
      textDocument: { uri },
      position: pos,
    })) as { items?: LspCompletionItem[] } | LspCompletionItem[] | null
    if (!r) return []
    return Array.isArray(r) ? r : (r.items ?? [])
  }

  async rename(uri: string, pos: LspPosition, newName: string): Promise<WorkspaceEdit | null> {
    const r = (await this.request('textDocument/rename', {
      textDocument: { uri },
      position: pos,
      newName,
    })) as WorkspaceEdit | null
    return r ?? null
  }

  async codeAction(
    uri: string,
    range: { start: LspPosition; end: LspPosition },
    diagnostics: LspDiagnostic[],
  ): Promise<LspCodeAction[]> {
    const r = await this.request('textDocument/codeAction', {
      textDocument: { uri },
      range,
      context: { diagnostics },
    })
    return normalizeCodeActions(r)
  }

  async executeCommand(command: string, args?: unknown[]): Promise<void> {
    await this.request('workspace/executeCommand', { command, arguments: args })
  }

  onDiagnostics(cb: (uri: string, diags: LspDiagnostic[]) => void): () => void {
    this.diagnosticsSubs.add(cb)
    return () => {
      this.diagnosticsSubs.delete(cb)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(new Error('lsp client disposed'))
    }
    this.pending.clear()
    this.transport.dispose()
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++
    this.transport.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`lsp timeout: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
    })
  }

  private notify(method: string, params: unknown): void {
    if (this.disposed) return
    this.transport.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
  }

  private handleMessage(raw: string): void {
    if (this.disposed) return
    let msg: {
      id?: number
      method?: string
      params?: unknown
      result?: unknown
      error?: { message?: string }
    }
    try {
      msg = JSON.parse(raw) as typeof msg
    } catch {
      return // malformado: se descarta, nunca se cae la bomba
    }

    if (msg.id !== undefined && msg.method === undefined) {
      // Respuesta a uno de nuestros requests.
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.error) p.reject(new Error(msg.error.message ?? 'lsp error'))
      else p.resolve(msg.result ?? null)
      return
    }

    if (msg.id !== undefined && msg.method !== undefined) {
      // Request server→cliente. No soportamos ninguno: se declina educadamente
      // para que el server no quede colgado esperando respuesta.
      this.transport.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: `method not supported: ${msg.method}` },
      }))
      return
    }

    if (msg.method === 'textDocument/publishDiagnostics') {
      const p = msg.params as { uri?: string; diagnostics?: LspDiagnostic[] } | undefined
      if (p?.uri && Array.isArray(p.diagnostics)) {
        for (const cb of this.diagnosticsSubs) cb(p.uri, p.diagnostics)
      }
    }
    // el resto de notificaciones se ignora
  }
}

function normalizeLocations(r: unknown): LspLocation[] {
  if (!r) return []
  const arr = Array.isArray(r) ? r : [r]
  return arr.flatMap(item => {
    const link = item as { targetUri?: string; targetSelectionRange?: LspLocation['range'] }
    if (link.targetUri && link.targetSelectionRange) {
      return [{ uri: link.targetUri, range: link.targetSelectionRange }]
    }
    const loc = item as { uri?: string; range?: LspLocation['range'] }
    if (loc.uri && loc.range) return [{ uri: loc.uri, range: loc.range }]
    return []
  })
}

/**
 * `(Command | CodeAction)[]`. Discriminador del spec: en un Command pelado,
 * `.command` es el id del comando (un STRING); en un CodeAction, `.command` —si
 * está, como seguimiento post-edit— es un objeto `{command, arguments}`. Es la
 * única marca confiable: ambos comparten `.title`, y un CodeAction puede traer
 * `.command` junto con `.edit`.
 */
function normalizeCodeActions(r: unknown): LspCodeAction[] {
  if (!Array.isArray(r)) return []
  return r.flatMap((item): LspCodeAction[] => {
    const it = item as {
      title?: string
      edit?: WorkspaceEdit
      command?: string | LspCommand
      arguments?: unknown[]
    }
    if (typeof it.title !== 'string') return []
    if (typeof it.command === 'string') {
      return [{ title: it.title, command: { command: it.command, arguments: it.arguments } }]
    }
    return [{ title: it.title, edit: it.edit, command: it.command }]
  })
}

function markupToString(contents: unknown): string | null {
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) {
    const parts = contents.map(c => markupToString(c)).filter((s): s is string => Boolean(s))
    return parts.length ? parts.join('\n\n') : null
  }
  const m = contents as { value?: string }
  return typeof m.value === 'string' ? m.value : null
}
