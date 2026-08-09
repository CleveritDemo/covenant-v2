// Dueño singleton de los servers LSP del lado del renderer. Todo se indexa por
// el `serverId` que devuelve `lspStart` (el main deduplica por (lenguaje, raíz)),
// y cada server tiene EXACTAMENTE un LspClient, así los ids de request nunca
// colisionan entre dos editores abiertos del mismo workspace.
import type { ViewUpdate } from '@codemirror/view'
import { lspLanguageId } from '@shared/lspLanguages'
import type { LspRuntimeSuggestion } from '@shared/lspTypes'
import { LspClient, type LspContentChange, type LspDiagnostic, type Transport } from './client'
import { LruIdlePolicy } from './lru'
import { offsetToLsp, pathToUri } from './positions'

// Tope de servers LSP vivos a la vez y cuánto sobrevive uno inactivo (sin docs
// abiertos) antes de que lo paremos. Lo maneja el renderer porque el manager es
// el único que lleva el refcount de docs abiertos y sabe cuándo uno queda ocioso.
const LSP_SERVER_CAP = 4
const LSP_IDLE_MS = 10 * 60 * 1000
const SWEEP_INTERVAL_MS = 60_000

export type LspDocStatus =
  | { kind: 'unsupported' }
  | { kind: 'disabled' }
  | {
      kind: 'needs-runtime'
      name: string
      min: string
      found: string | null
      suggestion: LspRuntimeSuggestion | null
    }
  | { kind: 'consent-needed'; name: string; approxSizeMb: number }
  | { kind: 'downloading'; percent: number | null }
  | { kind: 'starting' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export { lspLanguageId }

// ─── Consentimiento y toggle maestro ────────────────────────────────────────
// Gravity no tiene un store de settings por IPC, así que esto vive en
// localStorage del renderer, igual que el resto de preferencias de UI.
// ponytail: dos claves y un Set en memoria; si algún día hay settings store de
// verdad, esto se muda ahí sin tocar a los llamadores.

const ENABLED_KEY = 'lsp.enabled'
const CONSENT_PREFIX = 'lsp.consent.'

// Los accesos van envueltos como en `reduceMotion.ts`: localStorage puede no
// existir o tirar (modo test, storage bloqueado) y quedarse sin preferencia no
// puede tumbar el panel de ajustes ni el editor.
function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sin persistencia: la preferencia dura lo que dure la sesión */
  }
}

export function codeIntelEnabled(): boolean {
  return readStore(ENABLED_KEY) !== '0'
}

export function setCodeIntelEnabled(enabled: boolean): void {
  writeStore(ENABLED_KEY, enabled ? '1' : '0')
  notifyCodeIntelChange()
}

export function consentState(language: string): boolean {
  return codeIntelEnabled() && readStore(CONSENT_PREFIX + language) === 'granted'
}

export function grantConsentFor(language: string): void {
  writeStore(CONSENT_PREFIX + language, 'granted')
  notifyCodeIntelChange()
}

type CodeIntelListener = () => void
const codeIntelListeners = new Set<CodeIntelListener>()

/**
 * Cambiar el toggle sólo afectaría al PRÓXIMO archivo que se abra: una pestaña
 * que ya tiene su `LspDoc` sigue viva hasta reabrirse. Suscribiéndose acá el
 * editor puede re-evaluar lo que tenga abierto y apagar la sesión en el acto.
 */
export function onCodeIntelChange(cb: CodeIntelListener): () => void {
  codeIntelListeners.add(cb)
  return () => {
    codeIntelListeners.delete(cb)
  }
}

function notifyCodeIntelChange(): void {
  for (const cb of codeIntelListeners) cb()
}

// ─── Transporte sobre la IPC de Electron ────────────────────────────────────

class IpcTransport implements Transport {
  private cb: (m: string) => void = () => {}

  constructor(private readonly serverId: number) {}

  send(message: string): void {
    window.api.lspSend(this.serverId, message)
  }

  onMessage(cb: (message: string) => void): void {
    this.cb = cb
  }

  deliver(message: string): void {
    this.cb(message)
  }

  dispose(): void {
    this.cb = () => {}
  }
}

interface ServerEntry {
  serverId: number
  client: LspClient
  /** uri → refcount de aperturas. */
  openDocs: Map<string, number>
  unlisten: Array<() => void>
}

export class LspDoc {
  private closed = false

  constructor(
    readonly client: LspClient,
    readonly uri: string,
    readonly serverId: number,
    /** Raíz del explorador de la sesión, para mapear absoluto → relativo. */
    readonly sessionRoot: string,
    private readonly onClose: (uri: string) => void,
  ) {}

  /**
   * Mapea un `ViewUpdate` de CM6 a cambios incrementales de LSP y los manda ya.
   *
   * `update.changes.iterChanges` entrega ediciones sin solapamiento en orden
   * ASCENDENTE de offset, todas expresadas en coordenadas de
   * `update.startState.doc` (pre-transacción). LSP aplica las entradas de
   * `contentChanges` EN SECUENCIA —cada una muta el documento antes de la
   * siguiente—, así que mandarlas en ese mismo orden ascendente estaría mal: una
   * edición temprana corre todos los offsets posteriores e invalida los rangos
   * que se calcularon contra el documento ORIGINAL. Invertir a orden descendente
   * lo arregla: aplicar primero la edición más a la derecha nunca toca nada a su
   * izquierda, así que cuando le toca el turno a cada rango restante sus
   * coordenadas del start state siguen siendo válidas.
   */
  changeIncremental(update: ViewUpdate): void {
    if (this.closed) return
    const changes: LspContentChange[] = []
    update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      changes.push({
        range: {
          start: offsetToLsp(update.startState.doc, fromA),
          end: offsetToLsp(update.startState.doc, toA),
        },
        text: inserted.toString(),
      })
    })
    if (changes.length === 0) return
    changes.reverse()
    // ponytail: sin debounce — cada transacción de CM6 va como su propio
    // didChange. Los deltas incrementales son baratos; los servers aguantan un
    // didChange por tecla sin despeinarse.
    this.client.didChange(this.uri, changes)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.onClose(this.uri)
  }

  onDiagnostics(cb: (diags: LspDiagnostic[]) => void): () => void {
    return this.client.onDiagnostics((uri, diags) => {
      if (uri === this.uri) cb(diags)
    })
  }
}

class LspManager {
  private servers = new Map<number, ServerEntry>()
  // Creación en vuelo, por serverId, para que dos `open()` concurrentes del
  // mismo server compartan UNA creación en lugar de armar cada uno su LspClient.
  private creating = new Map<number, Promise<ServerEntry>>()
  private readonly policy = new LruIdlePolicy({
    cap: LSP_SERVER_CAP,
    idleMs: LSP_IDLE_MS,
    stop: id => this.dropServer(id),
  })
  // ponytail: un solo interval para todo el manager, no uno por server; arranca
  // con el primer server y se limpia cuando `servers` vuelve a quedar vacío.
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  private ensureSweepTimer(): void {
    if (this.sweepTimer) return
    this.sweepTimer = setInterval(() => this.policy.sweep(Date.now()), SWEEP_INTERVAL_MS)
  }

  private maybeClearSweepTimer(): void {
    if (this.servers.size === 0 && this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }

  async status(relPath: string): Promise<LspDocStatus> {
    const language = lspLanguageId(relPath)
    if (!language) return { kind: 'unsupported' }
    if (!codeIntelEnabled()) return { kind: 'disabled' }

    try {
      const st = await window.api.lspServerStatus(language)
      if ('error' in st) return { kind: 'error', message: st.error }
      if (st.installed) {
        // Instalado pero sin consentimiento todavía (p. ej. lo instaló otro
        // proyecto): igual hay que pedirlo antes de arrancar nada.
        return consentState(language)
          ? { kind: 'ready' }
          : { kind: 'consent-needed', name: st.name, approxSizeMb: st.approxSizeMb }
      }
      // Falta el runtime del todo: no tiene sentido caminar el flujo de
      // consentimiento/descarga si el server no va a poder ni arrancar.
      if (st.runtimeMissing) {
        return {
          kind: 'needs-runtime',
          name: st.runtimeMissing.name,
          min: st.runtimeMissing.min,
          found: st.runtimeMissing.found,
          suggestion: st.runtimeMissing.suggestion,
        }
      }
      return { kind: 'consent-needed', name: st.name, approxSizeMb: st.approxSizeMb }
    } catch (e) {
      return { kind: 'error', message: String(e) }
    }
  }

  /**
   * Descarga/instala el server. Dos formas de payload comparten el evento de
   * progreso según el camino que tome el main: las descargas binarias emiten
   * bytes `{received, total}`; los `npm install` no tienen progreso real y emiten
   * `{message}`. Se discrimina por la presencia de `received`, no por lenguaje.
   */
  async download(language: string, onProgress: (percent: number | null) => void): Promise<void> {
    const un = window.api.onLspDownloadProgress(language, payload => {
      if ('received' in payload) {
        const { received, total } = payload
        onProgress(total ? Math.round((received / total) * 100) : null)
      } else {
        onProgress(null)
      }
    })
    try {
      const result = await window.api.lspDownloadServer(language)
      if (!result.ok) throw new Error(result.error ?? 'download failed')
    } finally {
      un()
    }
  }

  /**
   * `postInitHandshake` lleva la carga de proyecto post-initialize de
   * csharp/Roslyn: `solution` manda `solution/open` (para un `.sln`/`.slnx`),
   * `project` manda `project/open` (para un `.csproj` pelado, donde
   * `solution/open` no carga nada). Se manda justo después de que `initialize`
   * resuelve y antes de publicar la entrada, así corre exactamente UNA vez por
   * server sin importar cuántos docs pidan `open()` — nunca por documento.
   */
  private async createEntry(
    serverId: number,
    rootUri: string,
    postInitHandshake: { kind: 'solution' | 'project'; uri: string } | null,
  ): Promise<ServerEntry> {
    const transport = new IpcTransport(serverId)
    const client = new LspClient(transport)
    const unMsg = window.api.onLspMessage(serverId, msg => transport.deliver(msg))
    const unExit = window.api.onLspExit(serverId, () => {
      // ponytail: sin auto-restart — se da de baja la entrada y el próximo
      // `open()` levanta uno nuevo.
      this.dropServer(serverId)
    })

    const entry: ServerEntry = { serverId, client, openDocs: new Map(), unlisten: [unMsg, unExit] }
    try {
      await client.initialize(rootUri)
      if (postInitHandshake?.kind === 'solution') client.openSolution(postInitHandshake.uri)
      else if (postInitHandshake?.kind === 'project') client.openProject(postInitHandshake.uri)
    } catch (e) {
      for (const un of entry.unlisten) un()
      client.dispose()
      window.api.lspStop(serverId)
      throw e
    }

    this.servers.set(serverId, entry)
    this.ensureSweepTimer()
    return entry
  }

  async open(sessionId: string, relPath: string, text: string): Promise<LspDoc> {
    const started = await window.api.lspStart(sessionId, relPath)
    if (!started.ok) throw new Error(started.error)
    const { serverId, root, filePath, sessionRoot, language, solutionPath, solutionKind } = started

    let entry = this.servers.get(serverId)
    if (!entry) {
      let creating = this.creating.get(serverId)
      if (!creating) {
        // ponytail: sólo csharp lo necesita hoy; si otro lenguaje pide un hook
        // post-initialize, esto se vuelve una tabla por lenguaje.
        const postInitHandshake =
          language === 'csharp' && solutionPath && solutionKind
            ? { kind: solutionKind, uri: pathToUri(solutionPath) }
            : null
        creating = this.createEntry(serverId, pathToUri(root), postInitHandshake).finally(() => {
          this.creating.delete(serverId)
        })
        this.creating.set(serverId, creating)
      }
      entry = await creating // ambos esperan la MISMA promesa → un solo cliente
    }

    const uri = pathToUri(filePath)
    const refs = entry.openDocs.get(uri) ?? 0
    if (refs === 0) entry.client.didOpen(uri, language, text)
    entry.openDocs.set(uri, refs + 1)
    this.policy.touch(serverId)

    const fixed = entry
    return new LspDoc(entry.client, uri, serverId, sessionRoot, u => {
      const n = (fixed.openDocs.get(u) ?? 1) - 1
      if (n <= 0) {
        fixed.openDocs.delete(u)
        fixed.client.didClose(u)
        // Se cerró el último doc de este server: quedó ocioso.
        if (fixed.openDocs.size === 0) this.policy.release(serverId, Date.now())
      } else {
        fixed.openDocs.set(u, n)
      }
    })
  }

  private dropServer(serverId: number): void {
    this.creating.delete(serverId)
    this.policy.remove(serverId)
    const entry = this.servers.get(serverId)
    if (!entry) return
    this.servers.delete(serverId)
    for (const un of entry.unlisten) un()
    entry.client.dispose()
    window.api.lspStop(serverId)
    this.maybeClearSweepTimer()
  }
}

export const lspManager = new LspManager()
