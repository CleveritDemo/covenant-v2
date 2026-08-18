/**
 * Binding de cuenta GitHub por workspace: `.gravity/github.json`.
 * Commiteable, sin secretos. JSON roto = sin cuenta.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { parseWorkspaceAccount } from '../src/shared/githubWorkspaceAccount'
import { projectDirPath } from './projectDir'

const CONFIG_FILE = 'github.json'

function configPath(cwd: string): string {
  return projectDirPath(cwd, CONFIG_FILE)
}

export function readWorkspaceAccountId(cwd: string): string | null {
  const path = configPath(cwd)
  if (!existsSync(path)) return null
  try {
    return parseWorkspaceAccount(JSON.parse(readFileSync(path, 'utf8')))?.accountId ?? null
  } catch {
    return null
  }
}

export function writeWorkspaceAccountId(cwd: string, accountId: string | null): void {
  try {
    const path = configPath(cwd)
    const id = typeof accountId === 'string' ? accountId.trim() : ''
    if (!id) {
      if (existsSync(path)) unlinkSync(path)
      return
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify({ accountId: id }, null, 2)}\n`, 'utf8')
  } catch {
    // Un fallo de disco no puede tumbar el turno.
  }
}

/** Binding vigente, o `null` si el id ya no está en el llavero (y entonces borra el archivo). Nunca lanza. */
export function resolveWorkspaceAccountId(
  cwd: string,
  knownAccountIds: readonly string[],
): string | null {
  try {
    const accountId = readWorkspaceAccountId(cwd)
    if (!accountId) return null
    if (knownAccountIds.includes(accountId)) return accountId
    writeWorkspaceAccountId(cwd, null)
    return null
  } catch {
    return null
  }
}
