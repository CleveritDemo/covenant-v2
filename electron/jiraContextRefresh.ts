/**
 * El único paso async del feature: refrescar los snapshots vencidos ANTES de
 * componer el turno.
 *
 * Jira escribe el archivo; el pipeline de contextos sigue haciendo lo único que
 * sabe hacer, leer disco. De ahí salen dos propiedades: si Jira está caído el
 * snapshot anterior sigue sirviendo, y la caché por mtime solo invalida cuando
 * el archivo cambió de verdad.
 */

import { basename, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { isSnapshotStale } from '../src/shared/jiraIssue'
import { issueAutoMarkdown, withJiraAutoBlock } from '../src/shared/jiraIssueDoc'
import { canonicalContextId, normalizeContextFileName, type TabContext } from '../src/shared/tabContext'
import { readJiraConfig, readJiraCredentials } from './jiraConfig'
import { jiraGetIssue } from './jiraClient'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof jiraGetIssue
}

/**
 * Misma clave de fallback que `contextFilePath` (tabContextBuild.ts): un context
 * jira recién descubierto en disco, antes de que la metadata persista el
 * `issueKey`, cae al nombre de archivo. Sin este espejo, esos contexts nunca se
 * refrescarían (se filtrarían al no tener `issueKey` explícito).
 */
function issueKeyFor(context: TabContext): string {
  return (context.issueKey || basename(context.fileName || context.name, '.md')).trim().toUpperCase()
}

export async function refreshStaleJiraContexts(
  contexts: readonly TabContext[],
  cwd: string,
  deps: RefreshDeps = {},
): Promise<void> {
  const pending = contexts.filter(context => context.kind === 'jira')
  if (!pending.length) return

  const config = readJiraConfig(cwd)
  if (!config) return
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return

  const fetchIssue = deps.fetchIssue ?? jiraGetIssue
  const now = Date.now()

  for (const context of pending) {
    try {
      const issueKey = issueKeyFor(context)
      // `normalizeContextFileName` (no concatenación) es lo que hace la
      // coincidencia con `contextFilePath` estructural en vez de casual: cierra
      // el mismo hueco de sanitización que ya cerraba el lado lector (un
      // issueKey `../../evil` no puede escribir fuera de `.gravity/jira/`).
      const filePath = projectDirPath(cwd, 'jira', normalizeContextFileName(issueKey, 'issue'))
      // `statSync` dentro del try: si el snapshot se borra entre este chequeo y
      // la lectura (TOCTOU), no debe tumbar el resto de los contexts pendientes.
      const mtimeMs = existsSync(filePath) ? statSync(filePath).mtimeMs : 0
      const refreshSeconds = context.refreshSeconds ?? config.refreshSeconds
      if (!isSnapshotStale(mtimeMs, refreshSeconds, now)) continue

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
      // Jira caído, clave inexistente o un stat que perdió la carrera con un
      // borrado: el snapshot anterior (si lo hay) sigue en disco y el turno
      // funciona igual. Nunca se propaga: esto corre en el camino del turno.
    }
  }
}
