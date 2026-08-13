import { createHash } from 'crypto'
import { describeFetchError, httpFetch } from '../httpFetch'
import { execFileSync, spawn } from 'child_process'
import { gunzipSync } from 'zlib'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { artifactFor, type ServerSpec } from './registry'

export function installRoot(dataDir: string, spec: ServerSpec): string {
  return join(dataDir, 'lsp', spec.name, spec.version)
}

/**
 * Path al entry ejecutable dentro del dir de instalación. Precedencia:
 * `entrySubpath` (entry anidado dentro de un archivo desempaquetado — el zip de
 * Roslyn) gana si está; si no, un server npm resuelve por `npm.binEntry`; si no
 * (el caso rust-analyzer binario/gzip) es `installRoot/cmd` directo.
 */
export function entryPath(dataDir: string, spec: ServerSpec): string {
  const root = installRoot(dataDir, spec)
  if (spec.entrySubpath) return join(root, spec.entrySubpath)
  if (spec.npm) return join(root, spec.npm.binEntry)
  return join(root, spec.cmd)
}

export function isInstalled(dataDir: string, spec: ServerSpec): boolean {
  try {
    return statSync(entryPath(dataDir, spec)).isFile()
  } catch {
    return false
  }
}

/** Tamaño en bytes del entry instalado, o 0 si no está. */
export function installedSize(dataDir: string, spec: ServerSpec): number {
  try {
    return statSync(entryPath(dataDir, spec)).size
  } catch {
    return 0
  }
}

/** Borra el dir de versión. Idempotente: borrar algo ausente no es error. */
export function removeInstall(dataDir: string, spec: ServerSpec): void {
  rmSync(installRoot(dataDir, spec), { recursive: true, force: true })
}

/**
 * Verifica el sha256 de los bytes crudos, desempaqueta y mueve a su lugar. La
 * verificación pasa ANTES de desempaquetar un solo byte.
 */
export function installFromBytes(bytes: Buffer, spec: ServerSpec, dataDir: string): string {
  const artifact = artifactFor(spec)
  if (!artifact) throw new Error(`no artifact for platform`)

  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual.toLowerCase() !== artifact.sha256.toLowerCase()) {
    throw new Error(`sha256 mismatch: expected ${artifact.sha256}, got ${actual}`)
  }

  const root = installRoot(dataDir, spec)
  // El último segmento de `root` es la versión completa, que puede tener puntos
  // ("4.3.0"). El staging se deriva del nombre entero y no de "reemplazar la
  // extensión", que sólo cambia el último segmento y colisionaría entre 4.3.0 y
  // 4.3.1.
  const staging = join(dirname(root), `${spec.version}.staging`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })

  try {
    extractInto(bytes, artifact.kind, spec, staging)

    // El entry dentro de `staging`: `entrySubpath` cuando el archivo lo anida,
    // si no `spec.cmd` directo (gzip: un binario plano escrito con ese nombre).
    const stagedEntry = join(staging, spec.entrySubpath ?? spec.cmd)
    chmodSync(stagedEntry, 0o755)

    rmSync(root, { recursive: true, force: true })
    mkdirSync(dirname(root), { recursive: true })
    renameSync(staging, root)
  } catch (e) {
    rmSync(staging, { recursive: true, force: true })
    throw e
  }

  gcOldVersions(root)
  return entryPath(dataDir, spec)
}

/**
 * Desempaqueta en `staging`. `unzip` y `tar` vienen con macOS y ya traen el
 * guard de zip-slip/tar-slip (descartan rutas absolutas y componentes `..`),
 * así que shelear a ellos evita meter una dependencia de descompresión.
 */
function extractInto(bytes: Buffer, kind: string, spec: ServerSpec, staging: string): void {
  if (kind === 'gzip') {
    writeFileSync(join(staging, spec.cmd), gunzipSync(bytes))
    return
  }

  const archivePath = join(staging, `.archive-${kind}`)
  writeFileSync(archivePath, bytes)
  try {
    if (kind === 'zip') {
      execFileSync('unzip', ['-q', '-o', archivePath, '-d', staging], { stdio: 'pipe' })
    } else if (kind === 'targz') {
      execFileSync('tar', ['-xzf', archivePath, '-C', staging], { stdio: 'pipe' })
    } else {
      throw new Error(`unknown archive kind: ${kind}`)
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`archive extraction failed (${kind}): ${detail}`)
  } finally {
    try {
      unlinkSync(archivePath)
    } catch {
      /* el rename del staging se lo lleva igual */
    }
  }
}

/** Las versiones viejas quedaron superadas: se borran (política: sólo la actual). */
function gcOldVersions(root: string): void {
  const nameDir = dirname(root)
  let entries: string[]
  try {
    entries = readdirSync(nameDir)
  } catch {
    return
  }
  for (const name of entries) {
    const p = join(nameDir, name)
    if (p === root) continue
    rmSync(p, { recursive: true, force: true })
  }
}

/**
 * Baja el artefacto de la plataforma actual y lo instala.
 * `onProgress(received, total)` se dispara por chunk.
 */
export async function downloadServer(
  spec: ServerSpec,
  dataDir: string,
  onProgress: (received: number, total: number | null) => void,
): Promise<string> {
  const artifact = artifactFor(spec)
  if (!artifact) throw new Error('no artifact for platform')

  let resp: Response
  try {
    resp = await httpFetch(artifact.url)
  } catch (error) {
    throw new Error(`download failed: ${describeFetchError(error)}`)
  }
  if (!resp.ok) throw new Error(`download failed: HTTP ${resp.status}`)
  if (!resp.body) throw new Error('download failed: empty body')

  const lenHeader = resp.headers.get('content-length')
  const total = lenHeader ? Number.parseInt(lenHeader, 10) : null
  const chunks: Buffer[] = []
  let received = 0
  const reader = resp.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    received += chunk.length
    chunks.push(chunk)
    onProgress(received, Number.isFinite(total) ? total : null)
  }
  return installFromBytes(Buffer.concat(chunks), spec, dataDir)
}

/**
 * Ubica el ejecutable `npm` para invocarlo directo (nunca por `sh -lc` con
 * argumentos interpolados). npm viaja junto a `node` en el mismo bin dir en toda
 * distribución mainstream (nvm, volta, fnm, Homebrew, el instalador oficial),
 * así que se prueba eso primero.
 */
function resolveNpmPath(nodeDir: string): string {
  const candidate = join(nodeDir, process.platform === 'win32' ? 'npm.cmd' : 'npm')
  if (existsSync(candidate)) return candidate
  // Gravity ya amplió process.env.PATH con el del login shell al arrancar.
  const fromPath = (process.env.PATH ?? '')
    .split(process.platform === 'win32' ? ';' : ':')
    .map(dir => join(dir.trim(), process.platform === 'win32' ? 'npm.cmd' : 'npm'))
    .find(p => existsSync(p))
  if (fromPath) return fromPath
  throw new Error('npm not found on PATH')
}

/**
 * Instala un server npm (typescript-language-server) en
 * `<dataDir>/lsp/<name>/<version>/` vía `npm install --prefix`.
 *
 * `nodeDir` es el dir del `node` resuelto del usuario: sirve para hallar `npm` y
 * para ponerlo en el PATH del hijo, así el shebang de npm resuelve su propio
 * node. Los paquetes van como args separados, nunca interpolados en un shell.
 * `onProgress` late periódicamente porque `npm install` no tiene progreso real.
 *
 * ponytail: npm ya verifica integridad vía su lockfile; confiamos en el registry del usuario.
 */
export async function npmInstallServer(
  spec: ServerSpec,
  dataDir: string,
  nodeDir: string,
  onProgress: (message: string) => void,
): Promise<string> {
  if (!spec.npm) throw new Error(`${spec.name} has no npm install method`)

  const root = installRoot(dataDir, spec)
  mkdirSync(root, { recursive: true })
  const npmPath = resolveNpmPath(nodeDir)

  const sep = process.platform === 'win32' ? ';' : ':'
  const child = spawn(npmPath, ['install', '--prefix', root, ...spec.npm.packages], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `${nodeDir}${sep}${process.env.PATH ?? ''}` },
  })

  onProgress('installing…')
  const ticker = setInterval(() => onProgress('installing…'), 500)
  let stderr = ''
  child.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString()
  })

  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    if (code !== 0) throw new Error(`npm install failed (${code}): ${stderr.trim()}`)
  } finally {
    clearInterval(ticker)
  }
  return entryPath(dataDir, spec)
}

/**
 * Copia recursiva de `src` dentro de `dst`, creando `dst` e intermedios.
 *
 * Materializa una copia ESCRIBIBLE del `-configuration` de jdtls: el launcher
 * equinox extrae una lib JNI en `<configuration>/org.eclipse.equinox.launcher/`
 * en cada arranque, y el dir de instalación tiene que quedar compartido/de sólo
 * lectura — apuntar `-configuration` ahí revienta con AccessDeniedException.
 * Los symlinks se saltean; no se esperan dentro de los config dirs del tar.gz.
 */
export function copyDirAll(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name)
    const to = join(dst, entry.name)
    if (entry.isDirectory()) copyDirAll(from, to)
    else if (entry.isFile()) copyFileSync(from, to)
  }
}
