/**
 * Binding de cuenta Jira por workspace: `.gravity/jira-account.json`.
 * Commiteable, sin secretos. JSON roto = sin cuenta.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { parseJiraWorkspaceAccount } from '../src/shared/jiraWorkspaceAccount'
import { projectDirPath } from './projectDir'

const CONFIG_FILE = 'jira-account.json'

function configPath(cwd: string): string {
  return projectDirPath(cwd, CONFIG_FILE)
}

export function readJiraWorkspaceAccountId(cwd: string): string | null {
  const path = configPath(cwd)
  if (!existsSync(path)) return null
  try {
    return parseJiraWorkspaceAccount(JSON.parse(readFileSync(path, 'utf8')))?.accountId ?? null
  } catch {
    return null
  }
}

export function writeJiraWorkspaceAccountId(cwd: string, accountId: string | null): void {
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
export function resolveJiraWorkspaceAccountId(
  cwd: string,
  knownAccountIds: readonly string[],
): string | null {
  try {
    const accountId = readJiraWorkspaceAccountId(cwd)
    if (!accountId) return null
    if (knownAccountIds.includes(accountId)) return accountId
    writeJiraWorkspaceAccountId(cwd, null)
    return null
  } catch {
    return null
  }
}
