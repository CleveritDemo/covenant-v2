import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'fs'
import { join, normalize, relative, resolve, sep } from 'path'
import type {
  LspDownloadProgress,
  LspInstalledServer,
  LspRuntimeSuggestion,
  LspServerStatus,
  LspStartResponse,
} from '../../src/shared/lspTypes'
import {
  copyDirAll,
  downloadServer,
  entryPath,
  installedSize,
  installRoot,
  isInstalled,
  npmInstallServer,
  removeInstall,
} from './install'
import {
  allSpecs,
  installKind,
  lspLanguageId,
  specForLanguage,
  type ServerSpec,
} from './registry'
import { detectRoot } from './root'
import { clearRuntimeCache, detectRuntimeCached, runtimeBinDir, suggestRuntimeFix } from './runtimeDetect'
import { spawnLspServer, type LspServerHandle } from './serverProcess'

interface LiveServer {
  handle: LspServerHandle
  /** Raíz del workspace calculada por el main; frontera de confianza para fs. */
  root: string
  language: string
}

type EmitFn = (channel: string, ...args: unknown[]) => void

let dataDir = ''
let emit: EmitFn = () => {}
let nextId = 1

const servers = new Map<number, LiveServer>()
/** `<language>\0<root>` → serverId, para deduplicar un server por workspace. */
const byKey = new Map<string, number>()

export interface LspEngineChannels {
  message: string
  exit: string
  downloadProgress: string
}

let channels: LspEngineChannels = { message: '', exit: '', downloadProgress: '' }

export function initLspEngine(opts: {
  dataDir: string
  emit: EmitFn
  channels: LspEngineChannels
}): void {
  dataDir = opts.dataDir
  emit = opts.emit
  channels = opts.channels
}

// ─── Estado / instalación ───────────────────────────────────────────────────

export function lspServerStatus(language: string): LspServerStatus | { error: string } {
  const spec = specForLanguage(language)
  if (!spec) return { error: `unknown language: ${language}` }

  let installed = isInstalled(dataDir, spec)
  let runtimeMissing: LspServerStatus['runtimeMissing'] = null

  // El gate de runtime es ortogonal al método de instalación: un server npm
  // (typescript) y uno binario-con-runtime (csharp/Roslyn, cuyo zip no tiene
  // nada que ver con `dotnet`) declaran ambos `spec.runtime` y se gatean igual.
  if (spec.runtime) {
    const rt = detectRuntimeCached(spec.runtime)
    if (!rt.ok) {
      let suggestion: LspRuntimeSuggestion | null = null
      try {
        suggestion = suggestRuntimeFix(spec.runtime)
      } catch {
        suggestion = null
      }
      runtimeMissing = { ...rt.missing, suggestion }
      installed = false
    }
  }

  return {
    language,
    name: spec.name,
    version: spec.version,
    installed,
    approxSizeMb: spec.approxSizeMb,
    runtimeMissing,
  }
}

/** Invalida el cache de detección de runtimes (botón "Recheck" de la UI). */
export function lspRecheckRuntimes(): void {
  clearRuntimeCache()
}

export async function lspDownloadServer(language: string): Promise<{ ok: boolean; error?: string }> {
  const spec = specForLanguage(language)
  if (!spec) return { ok: false, error: `unknown language: ${language}` }

  const progress = (payload: LspDownloadProgress): void => {
    emit(channels.downloadProgress, language, payload)
  }

  // Resolvemos el runtime primero para fallar rápido en vez de bajar 57 MB y
  // recién ahí descubrir que falta dotnet.
  let nodeDir: string | null = null
  if (spec.runtime) {
    const rt = detectRuntimeCached(spec.runtime)
    if (!rt.ok) {
      const { name, min, found } = rt.missing
      return { ok: false, error: `runtime ${name} not found or too old (need >= ${min}, found ${found ?? 'none'})` }
    }
    nodeDir = runtimeBinDir(rt.resolved)
  }

  try {
    if (installKind(spec) === 'npm') {
      if (!nodeDir) return { ok: false, error: `${spec.name} is an npm server but has no runtime spec` }
      await npmInstallServer(spec, dataDir, nodeDir, message => progress({ message }))
    } else {
      await downloadServer(spec, dataDir, (received, total) => progress({ received, total }))
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function lspListInstalled(): LspInstalledServer[] {
  return allSpecs().map(spec => ({
    language: spec.language,
    name: spec.name,
    version: spec.version,
    sizeBytes: installedSize(dataDir, spec),
    installed: isInstalled(dataDir, spec),
  }))
}

export function lspDeleteServer(language: string): { ok: boolean; error?: string } {
  const spec = specForLanguage(language)
  if (!spec) return { ok: false, error: `unknown language: ${language}` }
  try {
    removeInstall(dataDir, spec)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Búsqueda de solución (.sln/.csproj) para el handshake de Roslyn ────────

/** Dirs en los que nunca vale la pena bajar: salida de build, caches, VCS. */
const SKIP_DIRS = new Set(['bin', 'obj', 'node_modules', '.git'])
/** `root` es profundidad 0; `root/src/App.csproj` se halla en profundidad 1. */
const MAX_DESCENT_DEPTH = 3

/** Primer hijo directo de `root` (ordenado por nombre) cuyo nombre termina en `suffix`. */
function findDirectChild(root: string, suffix: string): string | null {
  try {
    const name = readdirSync(root).sort().find(n => n.endsWith(suffix))
    return name ? join(root, name) : null
  } catch {
    return null
  }
}

/**
 * Búsqueda en profundidad acotada bajo `dir` del primer archivo cuyo nombre
 * termina en `suffix`. Las entradas se ordenan para que el resultado sea estable
 * entre filesystems. Saltea `SKIP_DIRS` y dirs ocultos; corta en `MAX_DESCENT_DEPTH`.
 */
function findFirstBounded(dir: string, suffix: string, depth: number): string | null {
  if (depth > MAX_DESCENT_DEPTH) return null
  let entries: string[]
  try {
    entries = readdirSync(dir).sort()
  } catch {
    return null
  }

  // Primero los archivos de este nivel, para que un match más superficial gane
  // sobre uno hallado bajando por un hermano anterior.
  for (const name of entries) {
    const p = join(dir, name)
    try {
      if (statSync(p).isFile() && name.endsWith(suffix)) return p
    } catch {
      /* entrada inservible */
    }
  }
  for (const name of entries) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    try {
      if (!statSync(p).isDirectory()) continue
    } catch {
      continue
    }
    const found = findFirstBounded(p, suffix, depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Un `.sln`/`.slnx` (o si no un `.csproj`), para lenguajes cuyo server necesita
 * un handshake de carga de proyecto post-initialize (hoy sólo csharp/Roslyn).
 *
 * `root` es el ancestro más externo con alguno de los `rootMarkers` — para
 * csharp eso incluye `global.json`, que suele ser lo ÚNICO en la raíz del repo,
 * con el `.sln`/`.csproj` real anidado bajo `src/`. Por eso no se queda en los
 * hijos directos: prefiere un `.sln` en `root`, si no baja acotado, y repite lo
 * mismo para `.csproj`. El kind devuelto dice qué handshake mandar:
 * `solution/open` y `project/open` NO son intercambiables — `solution/open`
 * espera un `.sln`/`.slnx` de verdad y para un `.csproj` pelado carga nada.
 */
function findSolutionPath(root: string, language: string): { path: string; kind: 'solution' | 'project' } | null {
  if (language !== 'csharp') return null

  const sln = findDirectChild(root, '.sln')
    ?? findDirectChild(root, '.slnx')
    ?? findFirstBounded(root, '.sln', 1)
    ?? findFirstBounded(root, '.slnx', 1)
  if (sln) return { path: sln, kind: 'solution' }

  const proj = findDirectChild(root, '.csproj') ?? findFirstBounded(root, '.csproj', 1)
  if (proj) return { path: proj, kind: 'project' }

  console.warn(`[lsp] csharp: no .sln/.csproj under ${root}; cross-file resolution degraded`)
  return null
}

// ─── Ciclo de vida de servers ───────────────────────────────────────────────

/**
 * Argumentos de arranque. Cuatro casos:
 *  - npm: se lanza el `node` resuelto con el entry JS como primer argumento
 *    (el "binario" es un `.mjs` que no puede ejecutarse solo).
 *  - binario + configSubpath (java/jdtls): se lanza el `java` resuelto con el jar
 *    del launcher equinox vía `-jar`, más una copia ESCRIBIBLE por server del
 *    `configSubpath` (jdtls extrae una lib JNI ahí en cada arranque; un path de
 *    sólo lectura revienta) y un `-data` propio (omitirlo también revienta).
 *    Va antes del caso siguiente porque java también declara `runtime`.
 *  - binario con runtime (csharp/Roslyn): se lanza `entryPath` DIRECTO — el
 *    apphost resuelve dotnet solo, nunca lanzamos `dotnet <entry>` — pero exige
 *    los flags obligatorios del CLI de Roslyn y un log dir escribible.
 *  - binario sin runtime (rust-analyzer): `entryPath` con `spec.args`.
 */
function buildSpawnArgs(spec: ServerSpec, id: number): { bin: string; args: string[] } {
  const entry = entryPath(dataDir, spec)

  if (installKind(spec) === 'npm') {
    if (!spec.runtime) throw new Error(`${spec.name} is an npm server but has no runtime spec`)
    const rt = detectRuntimeCached(spec.runtime)
    if (!rt.ok) throw new Error(`runtime ${spec.runtime.name} not available`)
    return { bin: rt.resolved.path, args: [entry, ...spec.args] }
  }

  if (spec.configSubpath) {
    if (!spec.runtime) throw new Error(`${spec.name} is a java server but has no runtime spec`)
    const rt = detectRuntimeCached(spec.runtime)
    if (!rt.ok) throw new Error(`runtime ${spec.runtime.name} not available`)

    // Dirs escribibles por server. TIENEN que vivir fuera de `lsp/jdtls/`: el
    // GC de versiones de `installFromBytes` borra todo hermano de `installRoot`
    // ahí, y se llevaría el config/workspace de un server vivo en la próxima
    // descarga. Usamos un padre aparte, igual que `lsp/logs/<id>` para C#.
    const serverDir = join(dataDir, 'lsp', 'jdtls-servers', String(id))
    const configDst = join(serverDir, 'config')
    const workspaceDir = join(serverDir, 'data')
    copyDirAll(join(installRoot(dataDir, spec), spec.configSubpath), configDst)
    mkdirSync(workspaceDir, { recursive: true })

    return {
      bin: rt.resolved.path,
      args: [
        '-Declipse.application=org.eclipse.jdt.ls.core.id1',
        '-Dosgi.bundles.defaultStartLevel=4',
        '-Declipse.product=org.eclipse.jdt.ls.core.product',
        '-Dfile.encoding=UTF-8',
        '-Xmx1G',
        '--add-modules=ALL-SYSTEM',
        '--add-opens', 'java.base/java.util=ALL-UNNAMED',
        '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
        '-jar', entry,
        '-configuration', configDst,
        '-data', workspaceDir,
        ...spec.args,
      ],
    }
  }

  if (spec.runtime) {
    const logDir = join(dataDir, 'lsp', 'logs', String(id))
    mkdirSync(logDir, { recursive: true })
    return {
      bin: entry,
      args: ['--logLevel', 'Information', '--extensionLogDirectory', logDir, '--stdio', ...spec.args],
    }
  }

  return { bin: entry, args: [...spec.args] }
}

/**
 * Arranca (o reutiliza) un server para `relPath` dentro de `sessionRoot`.
 *
 * Todo el trabajo es síncrono, así que dos llamadas concurrentes para el mismo
 * (language, root) no pueden cruzarse: la segunda ve el server de la primera ya
 * publicado en `byKey`. Es la razón por la que acá no hay ni el doble chequeo ni
 * la limpieza del perdedor que sí necesita la versión async.
 */
export function lspStart(sessionRoot: string, relPath: string): LspStartResponse {
  const filePath = resolveInsideRoot(sessionRoot, relPath)
  if (!filePath) return { ok: false, error: 'path outside project root' }

  const language = lspLanguageId(filePath)
  if (!language) return { ok: false, error: 'unsupported language' }
  const spec = specForLanguage(language)
  if (!spec) return { ok: false, error: `unknown language: ${language}` }
  if (!isInstalled(dataDir, spec)) return { ok: false, error: `${spec.name} is not installed` }

  // Gate de runtime: cualquier spec con runtime (npm Y binario-con-runtime como
  // Roslyn) tiene que tenerlo antes de arrancar, aunque el entry ya esté instalado.
  if (spec.runtime) {
    const rt = detectRuntimeCached(spec.runtime)
    if (!rt.ok) {
      const { name, min, found } = rt.missing
      return { ok: false, error: `runtime ${name} not found or too old (need >= ${min}, found ${found ?? 'none'})` }
    }
  }

  const root = detectRoot(filePath, spec.rootMarkers)
  const solution = findSolutionPath(root, language)
  const key = `${language}\0${root}`

  const existing = byKey.get(key)
  if (existing !== undefined && servers.has(existing)) {
    return {
      ok: true,
      serverId: existing,
      root,
      filePath,
      sessionRoot: realRoot(sessionRoot),
      language,
      solutionPath: solution?.path ?? null,
      solutionKind: solution?.kind ?? null,
    }
  }

  const id = nextId++
  let handle: LspServerHandle
  try {
    const { bin, args } = buildSpawnArgs(spec, id)
    handle = spawnLspServer({
      bin,
      args,
      cwd: root,
      onMessage: msg => emit(channels.message, String(id), msg),
      onExit: () => {
        // Un server caído deja un id muerto para siempre si no se limpia acá:
        // el próximo lspStart para el mismo (language, root) nunca volvería a
        // andar. Se avisa al renderer y se saca del registro.
        emit(channels.exit, String(id))
        servers.delete(id)
        for (const [k, v] of byKey) if (v === id) byKey.delete(k)
        console.warn(`[lsp] server ${id} (${language}) exited; registry entry cleaned up`)
      },
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  servers.set(id, { handle, root, language })
  byKey.set(key, id)
  console.info(`[lsp] server ${id} started: ${language} @ ${root}`)

  return {
    ok: true,
    serverId: id,
    root,
    filePath,
    sessionRoot: realRoot(sessionRoot),
    language,
    solutionPath: solution?.path ?? null,
    solutionKind: solution?.kind ?? null,
  }
}

export function lspSend(serverId: number, message: string): void {
  servers.get(serverId)?.handle.send(message)
}

export function lspStop(serverId: number): void {
  const entry = servers.get(serverId)
  servers.delete(serverId)
  for (const [k, v] of byKey) if (v === serverId) byKey.delete(k)
  entry?.handle.kill()
}

export function stopAllLspServers(): void {
  for (const { handle } of servers.values()) handle.kill()
  servers.clear()
  byKey.clear()
}

// ─── Lectura/escritura de archivos para WorkspaceEdit ───────────────────────

/**
 * Un rename LSP toca archivos que el renderer nunca abrió, así que necesita
 * leer/escribir por path absoluto. La frontera de confianza es la raíz del
 * workspace que el MAIN calculó (`detectRoot`), no una que mande el renderer:
 * un path fuera de ella se rechaza.
 */
function resolveInsideRoot(root: string, candidate: string): string | null {
  const raw = String(candidate ?? '').trim()
  if (!raw || raw.includes('\0')) return null

  const base = realRoot(root)
  const abs = resolve(base, raw)
  const real = existsSync(abs) ? safeRealpath(abs) : abs

  const rel = relative(base, real)
  if (rel === '' || rel.startsWith('..') || rel.split(sep).includes('..')) return null
  return real
}

/**
 * Raíz normalizada Y con symlinks resueltos.
 *
 * Tiene que ser la MISMA forma que devuelve `resolveInsideRoot`: en macOS `/var`
 * es un symlink a `/private/var`, así que devolver la raíz sin resolver mientras
 * las rutas de archivo sí lo están rompe el `startsWith` con el que el renderer
 * decide si un destino de go-to-definition cae dentro del proyecto.
 */
function realRoot(root: string): string {
  return safeRealpath(resolve(normalize(String(root).trim())))
}

function safeRealpath(p: string): string {
  try {
    return realpathSync.native(p)
  } catch {
    return p
  }
}

export function lspReadFile(serverId: number, absPath: string): { ok: boolean; content?: string; error?: string } {
  const entry = servers.get(serverId)
  if (!entry) return { ok: false, error: 'unknown lsp server' }
  const safe = resolveInsideRoot(entry.root, absPath)
  if (!safe) return { ok: false, error: 'path outside workspace root' }
  try {
    return { ok: true, content: readFileSync(safe, 'utf8') }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function lspWriteFile(
  serverId: number,
  absPath: string,
  content: string,
): { ok: boolean; error?: string } {
  const entry = servers.get(serverId)
  if (!entry) return { ok: false, error: 'unknown lsp server' }
  const safe = resolveInsideRoot(entry.root, absPath)
  if (!safe) return { ok: false, error: 'path outside workspace root' }
  if (typeof content !== 'string') return { ok: false, error: 'invalid content' }
  try {
    writeFileSync(safe, content, 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
