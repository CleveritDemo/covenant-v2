import { existsSync, readdirSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { LspRuntimeSuggestion } from '../../src/shared/lspTypes'
import { resolveCommandAbsolutePath, splitPath } from '../shellPathEnv'
import type { RuntimeSpec } from './registry'

export interface ResolvedRuntime {
  path: string
  version: string
}

export interface RuntimeMissing {
  name: string
  min: string
  found: string | null
}

export type RuntimeDetectResult =
  | { ok: true; resolved: ResolvedRuntime }
  | { ok: false; missing: RuntimeMissing }

/**
 * Resuelve un runtime (node / dotnet / java) en el PATH del usuario.
 *
 * Las apps GUI de macOS heredan un PATH mínimo; Gravity ya arregla eso llamando
 * `applyLoginShellPath(process.env)` al arrancar (electron/main.ts), así que acá
 * alcanza con resolver contra `process.env.PATH` en vez de volver a pagar un
 * `$SHELL -lc` por cada chequeo.
 */
export function detectRuntime(req: RuntimeSpec): RuntimeDetectResult {
  const path = resolveCommandAbsolutePath(req.name)
  if (!path) {
    return { ok: false, missing: { name: req.name, min: req.minVersion, found: null } }
  }
  const raw = runVersion(path, req.versionArg)
  if (raw === null) {
    return { ok: false, missing: { name: req.name, min: req.minVersion, found: null } }
  }
  const version = extractVersion(raw) ?? raw.trim()
  if (!versionGe(version, req.minVersion)) {
    return { ok: false, missing: { name: req.name, min: req.minVersion, found: version } }
  }
  return { ok: true, resolved: { path, version } }
}

/**
 * `detectRuntime` gasta un `execFileSync` y corre en el main thread, que es el
 * mismo que atiende toda la IPC. Cada `lspStart` lo pediría de nuevo, así que se
 * cachea por (nombre, versión mínima) durante la vida del proceso. El botón
 * "Recheck" de la UI llama `clearRuntimeCache()` — es lo que hace que instalar
 * node y volver a chequear funcione sin reiniciar la app.
 */
const runtimeCache = new Map<string, RuntimeDetectResult>()

export function detectRuntimeCached(req: RuntimeSpec): RuntimeDetectResult {
  const key = `${req.name}\0${req.minVersion}\0${req.versionArg}`
  const hit = runtimeCache.get(key)
  if (hit) return hit
  const result = detectRuntime(req)
  runtimeCache.set(key, result)
  return result
}

export function clearRuntimeCache(): void {
  runtimeCache.clear()
}

/** stdout del flag de versión; cae a stderr porque no todo runtime usa stdout. */
function runVersion(exe: string, versionArg: string): string | null {
  try {
    const stdout = execFileSync(exe, [versionArg], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const trimmed = String(stdout).trim()
    return trimmed || null
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string }
    const fallback = String(err?.stdout ?? '').trim() || String(err?.stderr ?? '').trim()
    return fallback || null
  }
}

/**
 * Busca en `output` el primer token que parezca versión (`\d+(\.\d+)+`, con una
 * `v` inicial tolerada). A diferencia de tomar el primer token a secas, esto
 * saltea palabras de vendor: `"openjdk 17.0.18 2026-01-20"` tiene `openjdk`
 * primero, no una versión. Para runtimes cuyo primer token YA es la versión
 * (`v18.19.0` de node, `10.0.101` de dotnet) devuelve lo mismo que el parseo
 * ingenuo, así que es una generalización pura.
 */
export function extractVersion(output: string): string | null {
  for (const token of output.split(/\s+/)) {
    // Recorta puntuación que una etiqueta pueda arrastrar, sin aceptar basura.
    const candidate = token.replace(/^v/, '').replace(/^[^\d.]+/, '').replace(/[^\d.]+$/, '')
    if (isVersionLike(candidate)) return candidate
  }
  return null
}

/** `\d+(\.\d+)+` — al menos un punto, cada segmento numérico y no vacío. */
function isVersionLike(s: string): boolean {
  return /^\d+(\.\d+)+$/.test(s)
}

/** True si `found` (p. ej. "v18.19.0") es >= `min` ("18" o "18.2") en major[.minor]. */
export function versionGe(found: string, min: string): boolean {
  const parts = (s: string): [number, number] | null => {
    const m = s.trim().replace(/^v/, '').split('.')
    const major = Number.parseInt(m[0] ?? '', 10)
    if (!Number.isFinite(major)) return null
    const minor = Number.parseInt(m[1] ?? '', 10)
    return [major, Number.isFinite(minor) ? minor : 0]
  }
  const f = parts(found)
  const m = parts(min)
  if (!f || !m) return false
  return f[0] !== m[0] ? f[0] > m[0] : f[1] >= m[1]
}

/** Clave ordenable (major, minor, patch); segmentos faltantes o basura → 0. */
function versionKey(v: string): [number, number, number] {
  const it = v.trim().replace(/^v/, '').split('.')
  const p = (x: string | undefined): number => {
    const n = Number.parseInt(x ?? '', 10)
    return Number.isFinite(n) ? n : 0
  }
  return [p(it[0]), p(it[1]), p(it[2])]
}

/** De los candidatos `(dir, version)`, el más nuevo que cumpla `>= min`. */
export function pickNewestSatisfying(
  candidates: Array<{ dir: string; version: string }>,
  min: string,
): { dir: string; version: string } | null {
  let best: { dir: string; version: string } | null = null
  let bestKey: [number, number, number] = [-1, -1, -1]
  for (const c of candidates) {
    if (!versionGe(c.version, min)) continue
    const key = versionKey(c.version)
    if (key[0] > bestKey[0]
      || (key[0] === bestKey[0] && key[1] > bestKey[1])
      || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] > bestKey[2])) {
      best = c
      bestKey = key
    }
  }
  return best
}

/** `/opt/homebrew/opt/<prefix>*​/bin` para cada keg cuyo nombre empiece con prefix. */
function homebrewOptBins(prefix: string): string[] {
  const base = '/opt/homebrew/opt'
  try {
    return readdirSync(base)
      .filter(name => name.startsWith(prefix))
      .map(name => join(base, name, 'bin'))
  } catch {
    return []
  }
}

/** Para cada subdirectorio directo de `parent`, agrega `<child>/<sub>`. */
function globChildren(parent: string, sub: string): string[] {
  try {
    return readdirSync(parent)
      .map(name => join(parent, name))
      .filter(p => {
        try {
          return statSync(p).isDirectory()
        } catch {
          return false
        }
      })
      .map(p => join(p, sub))
  } catch {
    return []
  }
}

/**
 * Bin dirs donde buscar un runtime, curados para macOS. Cada dir devuelto
 * debería contener un ejecutable llamado `name`.
 * ponytail: lista curada, no un walk del filesystem; se extiende por OS si hace falta.
 */
function candidateBinDirs(name: string): string[] {
  const home = homedir()
  const dirs: string[] = []
  if (name === 'java') {
    dirs.push(...homebrewOptBins('openjdk'))
    // `java_home -V` lista cada JVM registrada; imprime en stderr.
    try {
      execFileSync('/usr/libexec/java_home', ['-V'], {
        encoding: 'utf8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      const text = String((e as { stderr?: string })?.stderr ?? '')
      for (const line of text.split('\n')) {
        const idx = line.indexOf('/')
        if (idx === -1) continue
        const p = line.slice(idx).trim()
        try {
          if (statSync(p).isDirectory()) dirs.push(join(p, 'bin'))
        } catch {
          /* entrada inservible */
        }
      }
    }
    dirs.push(...globChildren(join(home, '.sdkman/candidates/java'), 'bin'))
  } else if (name === 'node') {
    dirs.push(...homebrewOptBins('node'))
    dirs.push('/usr/local/bin')
    dirs.push(...globChildren(join(home, '.nvm/versions/node'), 'bin'))
  } else if (name === 'dotnet') {
    // El dir de dotnet tiene el binario `dotnet` directo (sin /bin).
    dirs.push('/usr/local/share/dotnet')
    dirs.push(...homebrewOptBins('dotnet'))
  }
  return dirs
}

function installHint(name: string): string {
  if (name === 'java') return 'brew install openjdk'
  if (name === 'node') return 'brew install node'
  if (name === 'dotnet') return 'brew install dotnet'
  return `install ${name}`
}

/**
 * Se llama después de que `detectRuntime` reporta falta. Escanea ubicaciones
 * curadas: si hay una versión que sirve fuera del PATH, sugiere arreglar el
 * PATH; si no, un hint de instalación. Nunca falla.
 */
export function suggestRuntimeFix(req: RuntimeSpec): LspRuntimeSuggestion {
  const candidates: Array<{ dir: string; version: string }> = []
  for (const dir of candidateBinDirs(req.name)) {
    const exe = join(dir, req.name)
    if (!existsSync(exe)) continue
    const raw = runVersion(exe, req.versionArg)
    if (raw === null) continue
    const v = extractVersion(raw)
    if (v) candidates.push({ dir, version: v })
  }

  const winner = pickNewestSatisfying(candidates, req.minVersion)
  if (!winner) return { kind: 'install', hint: installHint(req.name) }

  const onPath = splitPath(process.env.PATH ?? '').includes(winner.dir)
  if (onPath) {
    // Ya está en el PATH y aun así `detectRuntime` falló → el de este dir
    // también es viejo. No le digas al usuario que agregue un dir que ya tiene.
    return { kind: 'install', hint: installHint(req.name) }
  }
  return { kind: 'onDiskNotOnPath', version: winner.version, dir: winner.dir }
}

/** Dir que contiene el binario resuelto — `npmInstall` lo usa para hallar `npm`. */
export function runtimeBinDir(resolved: ResolvedRuntime): string {
  return dirname(resolved.path)
}
