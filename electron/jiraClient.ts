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

/**
 * `commentsFor` es cuántos comentarios se pidieron al poblar la entrada. La
 * caché ya no puede guardar «todos» los comentarios: se piden explícitamente
 * los N más recientes al endpoint dedicado, así que una llamada posterior que
 * quiera MÁS no puede servirse de aquí y tiene que volver a la red.
 */
const cache = new Map<string, { at: number; issue: JiraIssueSnapshot; commentsFor: number }>()

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
    updated: String(fields.updated ?? ''),
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
    fields: 'summary,status,issuetype,assignee,updated',
  })
  const payload = asRecord(await getJson(cred, `/rest/api/3/search/jql?${query}`))
  const issues = Array.isArray(payload.issues) ? payload.issues : []
  return issues.map(refFrom)
}

function sprintNameFrom(fields: Record<string, any>): string | null {
  // El sprint es un campo custom cuyo id varía por instancia, así que se busca por
  // forma: un elemento de sprint agile trae `state` (activo/cerrado/futuro), algo
  // que `fixVersions`/`components` —también arrays de `{ name }`— nunca tienen.
  // Sin exigir `state` se podría devolver una fix version o un componente como si
  // fuera el sprint, dependiendo del orden de las claves del payload.
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue
    const sprintLike = value.filter(entry => typeof asRecord(entry).state === 'string')
    if (!sprintLike.length) continue
    const active = sprintLike.find(entry => asRecord(entry).state === 'active')
    const name = asRecord(active ?? sprintLike[sprintLike.length - 1]).name
    if (typeof name === 'string' && name) return name
  }
  return null
}

/**
 * Recorta a los `maxComments` más recientes de un array YA en orden
 * cronológico. `0` (o negativo) es cero comentarios, no «todos»: es el mismo
 * criterio que `refreshSeconds: 0` en el campo de al lado, donde 0 apaga la
 * función. Que un 0 significara «sin límite» y el otro «desactivado» en el
 * mismo archivo de configuración era una trampa.
 */
function sliceComments(comments: JiraComment[], maxComments: number): JiraComment[] {
  return maxComments > 0 ? comments.slice(-maxComments) : []
}

function commentFrom(raw: unknown): JiraComment {
  const comment = asRecord(raw)
  return {
    author: String(asRecord(comment.author).displayName ?? ''),
    created: String(comment.created ?? ''),
    body: adfToText(comment.body),
  }
}

/**
 * Los `maxComments` comentarios MÁS RECIENTES, en orden cronológico.
 *
 * Endpoint dedicado y `orderBy=-created` explícito, no el `comment` que viene
 * embebido en el GET de la issue: ese campo está paginado desde `startAt: 0`,
 * así que para un ticket con más comentarios que una página devuelve los MÁS
 * VIEJOS. Recortar la cola de esa página daba exactamente lo contrario de lo
 * que el documento promete («Comentarios (últimos 10)») — y ningún test podía
 * verlo, porque todos simulaban un hilo corto y completo.
 *
 * Mejor esfuerzo: si esta petición falla, el llamador se queda con los
 * comentarios embebidos. Perder el hilo entero de una issue que por lo demás
 * se leyó bien sería peor que servir el orden antiguo.
 */
async function fetchRecentComments(
  cred: JiraCredentials,
  key: string,
  maxComments: number,
): Promise<JiraComment[] | null> {
  if (maxComments <= 0) return []
  const query = new URLSearchParams({ orderBy: '-created', maxResults: String(maxComments) })
  try {
    const payload = asRecord(
      await getJson(cred, `/rest/api/3/issue/${encodeURIComponent(key)}/comment?${query}`),
    )
    const raw = Array.isArray(payload.comments) ? payload.comments : []
    // `-created` los devuelve del más nuevo al más viejo; el `.md` los quiere
    // como se leen en Jira, de arriba abajo en el tiempo.
    return raw.map(commentFrom).reverse()
  } catch (error) {
    console.warn(`[jira] ${key}: no se pudieron pedir los comentarios recientes`, error)
    return null
  }
}

export async function jiraGetIssue(
  cred: JiraCredentials,
  key: string,
  maxComments: number,
): Promise<JiraIssueSnapshot> {
  const cacheKey = `${cred.site}:${key}`
  const hit = cache.get(cacheKey)
  // Sirve de caché solo si trae al menos tantos comentarios como se piden
  // ahora: `maxComments` es un argumento por llamada, no una propiedad de la
  // issue, y ya no se guardan «todos» (ver `fetchRecentComments`).
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && maxComments <= hit.commentsFor) {
    return { ...hit.issue, comments: sliceComments(hit.issue.comments, maxComments) }
  }

  let payload: Record<string, any>
  let recentComments: JiraComment[] | null
  try {
    // En paralelo: pedir los comentarios aparte no puede costar otra ronda de
    // latencia encima del turno.
    ;[payload, recentComments] = await Promise.all([
      getJson(cred, `/rest/api/3/issue/${encodeURIComponent(key)}`).then(asRecord),
      fetchRecentComments(cred, key, maxComments),
    ])
  } catch (error) {
    throw new Error(`${key}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const fields = asRecord(payload.fields)
  const embedded = Array.isArray(asRecord(fields.comment).comments)
    ? (asRecord(fields.comment).comments as unknown[]).map(commentFrom)
    : []
  const comments = recentComments ?? embedded

  const issue: JiraIssueSnapshot = {
    ...refFrom(payload),
    priority: fields.priority ? String(asRecord(fields.priority).name ?? '') || null : null,
    sprint: sprintNameFrom(fields),
    updated: String(fields.updated ?? ''),
    url: `${cred.site}/browse/${key}`,
    description: adfToText(fields.description),
    acceptanceCriteria: null,
    // Ya son los `maxComments` más recientes, en orden cronológico.
    comments,
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

  // `commentsFor` refleja lo que realmente se pidió: si el fallback embebido
  // entró en juego, no se puede prometer más cobertura que la solicitada.
  cache.set(cacheKey, { at: Date.now(), issue, commentsFor: Math.max(0, maxComments) })
  return { ...issue, comments: sliceComments(issue.comments, maxComments) }
}
