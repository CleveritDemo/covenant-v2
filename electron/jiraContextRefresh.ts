/**
 * El único paso async del feature: refrescar los snapshots vencidos ANTES de
 * componer el turno.
 *
 * Jira escribe el archivo; el pipeline de contextos sigue haciendo lo único que
 * sabe hacer, leer disco. De ahí salen dos propiedades: si Jira está caído el
 * snapshot anterior sigue sirviendo, y la caché por mtime solo invalida cuando
 * el archivo cambió de verdad.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { isSnapshotStale } from '../src/shared/jiraIssue'
import { issueAutoMarkdown, withJiraAutoBlock } from '../src/shared/jiraIssueDoc'
import { canonicalContextId, type TabContext } from '../src/shared/tabContext'
import { readJiraConfig, readJiraCredentials } from './jiraConfig'
import { jiraGetIssue } from './jiraClient'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof jiraGetIssue
}

export async function refreshStaleJiraContexts(
  contexts: readonly TabContext[],
  cwd: string,
  deps: RefreshDeps = {},
): Promise<void> {
  const pending = contexts.filter(context => context.kind === 'jira' && context.issueKey)
  if (!pending.length) return

  const config = readJiraConfig(cwd)
  if (!config) return
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return

  const fetchIssue = deps.fetchIssue ?? jiraGetIssue
  const now = Date.now()

  for (const context of pending) {
    const issueKey = (context.issueKey ?? '').toUpperCase()
    const filePath = projectDirPath(cwd, 'jira', `${issueKey}.md`)
    const mtimeMs = existsSync(filePath) ? statSync(filePath).mtimeMs : 0
    const refreshSeconds = context.refreshSeconds ?? config.refreshSeconds
    if (!isSnapshotStale(mtimeMs, refreshSeconds, now)) continue

    try {
      const issue = await fetchIssue(credentials, issueKey, config.maxComments)
      const metadataLine = `<!-- iaterminal:context ${JSON.stringify({
        id: canonicalContextId('jira', { issueKey }),
        kind: 'jira',
        icon: 'jira',
      })} -->`
      const previous = mtimeMs ? readFileSync(filePath, 'utf8') : ''
      const next = withJiraAutoBlock(
        previous,
        metadataLine,
        issueAutoMarkdown(issue, config.maxComments),
      )
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, next, 'utf8')
    } catch {
      // Jira caído o clave inexistente: el snapshot anterior sigue en disco y el
      // turno funciona igual. Nunca se propaga: esto corre en el camino del turno.
    }
  }
}
