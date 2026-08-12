/**
 * Cliente REST de Jira Cloud (API v3). Tres endpoints, `fetch` nativo, sin SDK.
 *
 * Por qué no el MCP de Atlassian desde acá: añadiría una dependencia, el flujo
 * OAuth del server remoto, y devuelve texto pensado para un modelo en vez de un
 * objeto que la UI pueda pintar. El MCP sigue siendo el camino del agente para
 * escribir; este es el de la app para leer.
 */

import { adfToText } from '../src/shared/jiraIssueDoc'
import type { JiraComment, JiraIssueRef, JiraIssueSnapshot } from '../src/shared/jiraIssue'
import type { JiraCredentials } from './jiraConfig'

const TIMEOUT_MS = 10_000
/** Seis agentes con la misma issue en un turno son un GET, no seis. */
const CACHE_TTL_MS = 60_000

const cache = new Map<string, { at: number; issue: JiraIssueSnapshot }>()

export function clearJiraCache(): void {
  cache.clear()
}

function authHeaders(cred: JiraCredentials): Record<string, string> {
  const basic = Buffer.from(`${cred.email}:${cred.apiToken}`).toString('base64')
  return { Authorization: `Basic ${basic}`, Accept: 'application/json' }
}

async function getJson(cred: JiraCredentials, path: string): Promise<unknown> {
  const response = await fetch(`${cred.site}${path}`, {
    headers: authHeaders(cred),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Jira ${response.status}`)
  return response.json()
}

const asRecord = (value: unknown): Record<string, any> =>
  (value && typeof value === 'object' ? value : {}) as Record<string, any>

function refFrom(raw: unknown): JiraIssueRef {
  const issue = asRecord(raw)
  const fields = asRecord(issue.fields)
  return {
    key: String(issue.key ?? ''),
    summary: String(fields.summary ?? ''),
    status: String(asRecord(fields.status).name ?? ''),
    issueType: String(asRecord(fields.issuetype).name ?? ''),
    assignee: fields.assignee ? String(asRecord(fields.assignee).displayName ?? '') || null : null,
  }
}

export async function jiraMyself(
  cred: JiraCredentials,
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  try {
    const me = asRecord(await getJson(cred, '/rest/api/3/myself'))
    return { ok: true, displayName: String(me.displayName ?? '') }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function jiraSearch(
  cred: JiraCredentials,
  jql: string,
  max = 8,
): Promise<JiraIssueRef[]> {
  const query = new URLSearchParams({
    jql,
    maxResults: String(max),
    fields: 'summary,status,issuetype,assignee',
  })
  const payload = asRecord(await getJson(cred, `/rest/api/3/search/jql?${query}`))
  const issues = Array.isArray(payload.issues) ? payload.issues : []
  return issues.map(refFrom)
}

function sprintNameFrom(fields: Record<string, any>): string | null {
  // El sprint es un campo custom cuyo id varía por instancia; se busca el que
  // traiga objetos con `name` y `state`, que es la forma estable del agile field.
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue
    const active = value.find(entry => asRecord(entry).state === 'active')
    const name = asRecord(active ?? value[value.length - 1]).name
    if (typeof name === 'string' && name) return name
  }
  return null
}

export async function jiraGetIssue(
  cred: JiraCredentials,
  key: string,
  maxComments: number,
): Promise<JiraIssueSnapshot> {
  const cacheKey = `${cred.site}:${key}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.issue

  let payload: Record<string, any>
  try {
    payload = asRecord(await getJson(cred, `/rest/api/3/issue/${encodeURIComponent(key)}`))
  } catch (error) {
    throw new Error(`${key}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const fields = asRecord(payload.fields)
  const rawComments = Array.isArray(asRecord(fields.comment).comments)
    ? asRecord(fields.comment).comments as unknown[]
    : []
  const comments: JiraComment[] = rawComments.map(raw => {
    const comment = asRecord(raw)
    return {
      author: String(asRecord(comment.author).displayName ?? ''),
      created: String(comment.created ?? ''),
      body: adfToText(comment.body),
    }
  })

  const issue: JiraIssueSnapshot = {
    ...refFrom(payload),
    priority: fields.priority ? String(asRecord(fields.priority).name ?? '') || null : null,
    sprint: sprintNameFrom(fields),
    updated: String(fields.updated ?? ''),
    url: `${cred.site}/browse/${key}`,
    description: adfToText(fields.description),
    acceptanceCriteria: null,
    comments: maxComments > 0 ? comments.slice(-maxComments) : comments,
    subtasks: (Array.isArray(fields.subtasks) ? fields.subtasks : []).map(refFrom),
    links: (Array.isArray(fields.issuelinks) ? fields.issuelinks : []).map(raw => {
      const link = asRecord(raw)
      const target = asRecord(link.outwardIssue ?? link.inwardIssue)
      return {
        type: String(asRecord(link.type).name ?? 'relates'),
        key: String(target.key ?? ''),
        summary: String(asRecord(target.fields).summary ?? ''),
      }
    }).filter(link => link.key),
  }

  cache.set(cacheKey, { at: Date.now(), issue })
  return issue
}
