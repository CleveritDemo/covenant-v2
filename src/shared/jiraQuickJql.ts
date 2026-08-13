/**
 * JQL del picker de issues del composer. Puro: no depende de disco ni de red,
 * así que se testea directo sin mocks de Electron.
 */

import type { JiraProjectConfig } from './jiraConfig'
import { parsePartialIssueKey } from './jiraIssue'

/**
 * Texto del picker → JQL. Siempre difuso.
 *
 * Antes había una rama para lo que tuviera forma de clave: `key = CT-1`, una
 * igualdad exacta. Con eso, teclear una clave nunca sugería nada — o casaba esa
 * issue exacta o no casaba ninguna — y además `key = X` sobre una issue que no
 * existe hace que Jira rechace el JQL entero, no que devuelva cero filas. La
 * búsqueda por clave exacta ya la cubre la vista previa, que hace un GET
 * directo; el picker está para descubrir, así que busca por texto y punto.
 *
 * Se busca en `summary` y en `text` (que en Jira cubre resumen, descripción y
 * comentarios). El `~` exige comillas, y las comillas del usuario romperían el
 * JQL, así que se eliminan.
 */
export function buildJiraQuickJql(query: string, config: JiraProjectConfig): string {
  const safe = query.replace(/["\\]/g, ' ').trim()
  const scope = config.projectKeys.length
    ? `project in (${config.projectKeys.join(', ')})`
    : ''
  if (!safe) return [scope, config.defaultJql].filter(Boolean).join(' AND ')

  /*
   * Prefijo de clave (`CT-`, `CT-12`): se acota al proyecto y se ordena por
   * actividad. No se filtra por los dígitos aquí porque JQL no sabe casar un
   * prefijo de clave — eso se hace sobre el resultado, en `searchJiraQuick`.
   * Se usa el prefijo tecleado y no `config.projectKeys` a propósito: el
   * prefijo ES la clave del proyecto, así que esto funciona aunque Ajustes
   * tenga la lista mal puesta.
   */
  const partial = parsePartialIssueKey(safe)
  if (partial) return `project = ${partial.project} ORDER BY updated DESC`

  const fuzzy = `(summary ~ "${safe}*" OR text ~ "${safe}*")`
  return `${[scope, fuzzy].filter(Boolean).join(' AND ')} ORDER BY updated DESC`
}
