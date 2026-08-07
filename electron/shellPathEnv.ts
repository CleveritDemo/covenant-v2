import { accessSync, constants, existsSync, realpathSync } from 'fs'
import { execFileSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

const PATH_SEP = process.platform === 'win32' ? ';' : ':'

/** Particiones de PATH sin vacíos. */
export function splitPath(pathEnv: string): string[] {
  return pathEnv
    .split(PATH_SEP)
    .map(part => part.trim())
    .filter(Boolean)
}

/** Une segmentos de PATH preservando el primer orden y sin duplicados. */
export function mergePathEntries(...groups: string[][]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    for (const entry of group) {
      const key = process.platform === 'win32' ? entry.toLowerCase() : entry
      if (seen.has(key)) continue
      seen.add(key)
      out.push(entry)
    }
  }
  return out.join(PATH_SEP)
}

function existingDirs(candidates: string[]): string[] {
  return candidates.filter(dir => {
    try {
      return Boolean(dir) && existsSync(dir)
    } catch {
      return false
    }
  })
}

/** Binarios habituales fuera del PATH mínimo de apps GUI en macOS/Linux. */
export function defaultExtraBinDirsUnix(home = homedir()): string[] {
  return existingDirs([
    join(home, '.local', 'bin'),
    join(home, '.cursor', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ])
}

/** Directorios típicos de npm / Node / Cursor en Windows (apps GUI no los heredan). */
export function defaultExtraBinDirsWin(home = homedir()): string[] {
  const appData = process.env.APPDATA?.trim() || join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA?.trim() || join(home, 'AppData', 'Local')
  return existingDirs([
    join(appData, 'npm'),
    join(localAppData, 'npm'),
    join(localAppData, 'Programs', 'nodejs'),
    join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin'),
    join(home, '.cursor', 'bin'),
    join(home, '.local', 'bin'),
    'C:\\Program Files\\nodejs',
    'C:\\Program Files (x86)\\nodejs',
  ])
}

/** Binarios habituales fuera del PATH mínimo de apps GUI. */
export function defaultExtraBinDirs(home = homedir()): string[] {
  return process.platform === 'win32'
    ? defaultExtraBinDirsWin(home)
    : defaultExtraBinDirsUnix(home)
}

function readLoginShellPath(): string | undefined {
  if (process.platform === 'win32') return undefined
  const shell = process.env.SHELL?.trim() || '/bin/zsh'
  try {
    const stdout = execFileSync(shell, ['-ilc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 8000,
      env: {
        ...process.env,
        TERM: 'dumb',
      },
    })
    const trimmed = String(stdout).replace(/\r?\n/g, '').trim()
    return trimmed || undefined
  } catch {
    return undefined
  }
}

/** PATH de usuario+máquina (registro), no el PATH mínimo de la app GUI. */
export function readWindowsPersistentPath(): string | undefined {
  if (process.platform !== 'win32') return undefined
  try {
    const script = [
      "$u = [Environment]::GetEnvironmentVariable('Path','User')",
      "$m = [Environment]::GetEnvironmentVariable('Path','Machine')",
      "Write-Output (($u, $m) -join ';')",
    ].join('; ')
    const stdout = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        encoding: 'utf8',
        timeout: 8000,
        windowsHide: true,
      },
    )
    const trimmed = String(stdout).replace(/\r?\n/g, '').trim()
    return trimmed || undefined
  } catch {
    return undefined
  }
}

/**
 * Amplía `PATH` del proceso con el del shell/usuario y directorios comunes.
 * Necesario cuando Electron arranca desde el explorador/Dock sin el PATH de la terminal.
 */
export function applyLoginShellPath(env: NodeJS.ProcessEnv = process.env): void {
  const current = splitPath(env.PATH ?? env.Path ?? '')
  if (process.platform === 'win32') {
    const fromUser = splitPath(readWindowsPersistentPath() ?? '')
    const extras = defaultExtraBinDirs()
    env.PATH = mergePathEntries(fromUser, extras, current)
    return
  }
  const fromShell = splitPath(readLoginShellPath() ?? '')
  const extras = defaultExtraBinDirs()
  env.PATH = mergePathEntries(fromShell, extras, current)
}

/**
 * En Windows, npm suele instalar shims `.cmd` que `spawn(..., { shell: false })`
 * no encuentra si solo se pide el nombre sin extensión.
 */
export function resolveCliExecutable(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const trimmed = command.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes('/') || trimmed.includes('\\')) return trimmed
  if (process.platform !== 'win32') return trimmed

  const pathEnv = env.PATH ?? env.Path ?? ''
  const dirs = splitPath(pathEnv)
  const pathext = (env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map(ext => ext.trim())
    .filter(Boolean)
  const hasExt = /\.[a-z0-9]+$/i.test(trimmed)
  const names = hasExt
    ? [trimmed]
    : [
        trimmed,
        ...pathext.map(ext => `${trimmed}${ext.startsWith('.') ? ext : `.${ext}`}`),
      ]

  for (const dir of dirs) {
    for (const name of names) {
      const full = join(dir, name)
      try {
        accessSync(full, constants.F_OK)
        return full
      } catch {
        /* siguiente candidato */
      }
    }
  }
  return trimmed
}

/**
 * Resuelve un comando bare (`copilot`) a ruta absoluta vía PATH (+ .cmd/.exe en win32).
 * Usa realpath para seguir symlinks del binario npm. `null` = no está en el PATH.
 */
export function resolveCommandAbsolutePath(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const trimmed = command.trim()
  if (!trimmed) return null

  const tryRealpath = (path: string): string | null => {
    if (!existsSync(path)) return null
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return tryRealpath(trimmed)
  }

  const dirs = splitPath(env.PATH ?? env.Path ?? '')
  const names = process.platform === 'win32'
    ? [trimmed, `${trimmed}.cmd`, `${trimmed}.exe`, `${trimmed}.bat`]
    : [trimmed]

  for (const dir of dirs) {
    for (const name of names) {
      const resolved = tryRealpath(join(dir, name))
      if (resolved) return resolved
    }
  }
  return null
}

/** Mensaje legible para fallos típicos de spawn/cierre del CLI. */
export function formatCliSpawnFailure(
  command: string,
  code: number | null | undefined,
  stderr?: string,
): string {
  const detail = stderr?.trim()
  if (detail) return detail
  if (code === -4058 || code === 4058) {
    return [
      `No se encontró el CLI «${command}» (ENOENT / -4058).`,
      'En Windows, configura la ruta completa en Ajustes',
      '(p. ej. %APPDATA%\\npm\\claude.cmd) o asegúrate de que Node/npm esté en el PATH.',
    ].join(' ')
  }
  if (code == null) return `El CLI «${command}» terminó sin código de salida.`
  return `El CLI terminó con código ${code}.`
}
