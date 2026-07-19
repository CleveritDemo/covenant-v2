import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
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
      if (seen.has(entry)) continue
      seen.add(entry)
      out.push(entry)
    }
  }
  return out.join(PATH_SEP)
}

/** Binarios habituales fuera del PATH mínimo de apps GUI en macOS. */
export function defaultExtraBinDirs(home = homedir()): string[] {
  const candidates = [
    join(home, '.local', 'bin'),
    join(home, '.cursor', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]
  return candidates.filter(dir => {
    try {
      return existsSync(dir)
    } catch {
      return false
    }
  })
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

/**
 * Amplía `PATH` del proceso con el del shell de login y directorios comunes.
 * Necesario en macOS cuando Electron arranca desde Dock/Finder sin el PATH de la terminal.
 */
export function applyLoginShellPath(env: NodeJS.ProcessEnv = process.env): void {
  if (process.platform === 'win32') return
  const current = splitPath(env.PATH ?? '')
  const fromShell = splitPath(readLoginShellPath() ?? '')
  const extras = defaultExtraBinDirs()
  env.PATH = mergePathEntries(fromShell, extras, current)
}
