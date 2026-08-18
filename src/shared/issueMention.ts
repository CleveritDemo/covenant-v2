import type { GithubIssueRef } from './githubIssue'
import type { JiraIssueRef } from './jiraIssue'
import { parsePartialIssueKey } from './jiraIssue'

export type IssueMentionSourceId = 'jira' | 'github'

export interface IssueMentionRow {
  source: IssueMentionSourceId
  id: string
  label: string
  title: string
  meta: string[]
  updated: string
}

export type IssueMentionPicked =
  | { source: 'jira'; issue: JiraIssueRef }
  | { source: 'github'; issue: GithubIssueRef }

export interface IssueMentionRange {
  /** Offset donde empieza el token completo (incluye el `@` si es búsqueda libre). */
  start: number
  /** Siempre el `caret` recibido: el token termina justo donde miró `issueMentionRangeAt`. */
  end: number
  query: string
}

/**
 * Igual que `issueMentionQueryAt`, pero además dice DÓNDE empieza (y termina) el
 * token que disparó la mención — para poder reemplazarlo por la clave
 * canónica del issue elegido (`GRAV-4` truncado → `GRAV-412`) en vez de
 * dejarlo colgado en el borrador. `issueMentionQueryAt` es un envoltorio de esto:
 * mismo contrato, ya testeado, sin duplicar la regex.
 */
export function issueMentionRangeAt(
  text: string,
  caret: number,
  enabled: boolean,
): IssueMentionRange | null {
  if (!enabled) return null
  const clampedCaret = Math.max(0, caret)
  const before = (text ?? '').slice(0, clampedCaret)

  const sigil = before.match(/(?:^|\s)#([\w-]*)$/)
  if (sigil) {
    // -1: el `#` no está en el grupo capturado, pero sí en el token a reemplazar.
    return { start: clampedCaret - sigil[1].length - 1, end: clampedCaret, query: sigil[1] }
  }

  return null
}

/**
 * Qué está escribiendo el usuario justo antes del cursor, si es una mención.
 * Devuelve el rango del token y el término, o `null` si no hay nada que buscar.
 * Vive acá y no en el componente porque es la regla que decide cuándo la app
 * interrumpe al usuario: se testea sin React.
 *
 * El disparador es `#` — como en GitHub o Linear para tickets, y deja `@` libre
 * para dirigirse a un agente, que es lo que ese símbolo va a querer decir en
 * esta app.
 *
 * El patrón de clave suelto (`CT-128`) NO abre nada: en un chat es prosa, y con
 * la lista abierta Enter elige en vez de enviar. El campo «Issue key» del
 * formulario sí busca al teclear, pero no pasa por aquí — allí el campo entero
 * es la consulta.
 *
 * El prefijo `PROY-` solo abre el picker si `PROY` está en `projectKeys`: sin
 * ese filtro, `UTF-8`, `SHA-256` o `CVE-2023-30533` abrirían un picker en
 * medio de cualquier frase técnica.
 */
export function issueMentionQueryAt(
  text: string,
  caret: number,
  enabled: boolean,
): string | null {
  return issueMentionRangeAt(text, caret, enabled)?.query ?? null
}

/**
 * Qué fuentes disparar para lo tecleado después de `#`. Una fuente no
 * conectada no entra nunca. Dígitos → GitHub; `CT-` / `CT-12` → Jira;
 * cualquier otra cosa → las dos.
 */
export function selectIssueMentionSources(
  query: string,
  connected: { jira: boolean; github: boolean },
): IssueMentionSourceId[] {
  const trimmed = (query ?? '').trim()
  const digitsOnly = /^\d+$/.test(trimmed)
  const jiraKey = parsePartialIssueKey(trimmed) !== null
  const candidates: IssueMentionSourceId[] = digitsOnly
    ? ['github']
    : jiraKey
      ? ['jira']
      : ['jira', 'github']
  return candidates.filter(id => connected[id])
}

export function jiraRowFromIssue(issue: JiraIssueRef): IssueMentionRow {
  const projectKey = issue.key.split('-')[0] ?? ''
  return {
    source: 'jira',
    id: issue.key,
    label: issue.key,
    title: issue.summary,
    meta: ['Jira', issue.issueType, projectKey, issue.status].filter(Boolean),
    updated: issue.updated,
  }
}

/**
 * La fuente real la publica otra vía; este es el mínimo que consume el adaptador.
 */
export interface GithubIssueMentionSource {
  number: number
  title: string
  state: string
  repoFullName: string
  updated: string
}

export function githubRowFromIssue(issue: GithubIssueMentionSource): IssueMentionRow {
  return {
    source: 'github',
    id: `${issue.repoFullName}#${issue.number}`,
    label: `#${issue.number}`,
    title: issue.title,
    meta: ['GitHub', issue.repoFullName, issue.state].filter(Boolean),
    updated: issue.updated,
  }
}
