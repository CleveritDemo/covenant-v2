/**
 * JQL del picker de issues del composer. Puro: no depende de disco ni de red,
 * así que se testea directo sin mocks de Electron.
 */

import type { JiraProjectConfig } from './jiraConfig'
import { normalizeIssueKey } from './jiraIssue'

/**
 * Texto del picker → JQL. Una clave exacta busca esa issue; cualquier otra cosa
 * es texto libre acotado a los proyectos declarados. El `~` de Jira exige comillas,
 * y las comillas del usuario romperían el JQL, así que se eliminan.
 */
export function buildJiraQuickJql(query: string, config: JiraProjectConfig): string {
  const key = normalizeIssueKey(query)
  if (key) return `key = ${key}`
  const safe = query.replace(/["\\]/g, ' ').trim()
  const scope = config.projectKeys.length
    ? `project in (${config.projectKeys.join(', ')}) AND `
    : ''
  if (!safe) return `${scope}${config.defaultJql}`.replace(/^ AND /, '')
  return `${scope}summary ~ "${safe}*" ORDER BY updated DESC`
}
