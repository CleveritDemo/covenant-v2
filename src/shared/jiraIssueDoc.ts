/**
 * El `.md` de una issue: cómo se escribe y cómo se refresca sin pisar las notas.
 *
 * Dos regiones, igual que `results/<agent>.md`: `iaterminal:auto` la regenera el
 * host desde Jira, `iaterminal:notes` la escriben la persona o el agente. Este
 * módulo es el espejo de `withAgentResultsNotes()`: allá sobrevive `auto`, acá
 * sobrevive `notes`.
 */

import { AUTO_END, AUTO_START, extractSection, markdownSections, NOTES_END, NOTES_START } from './contextSections'
import type { JiraIssueSnapshot } from './jiraIssue'
import { canonicalContextId, canonicalContextName } from './tabContext'

const NOTES_PLACEHOLDER = '(no annotations yet)'

/**
 * La línea `<!-- iaterminal:context ... -->` de un `.md` de jira. Un único
 * punto de construcción para el refresher (`jiraContextRefresh.ts`) y para el
 * alta sin snapshot (`tabContextBuild.ts`): si cada uno armara su propio JSON
 * a mano, bastaría un campo que se les olvidara a uno de los dos (p. ej.
 * `name`, que `contextFromMetadata` exige — sin él el archivo existe pero
 * `discoverTabContexts` lo ignora en silencio) para que el documento que cada
 * lado produce dejara de ser el mismo.
 */
export function jiraContextMetadataLine(issueKey: string): string {
  // `issueKey` normalizado directo, no vía `canonicalContextName`: esa
  // función cae a `'Jira issue'` para una clave vacía (pensada para mostrar
  // *algo* en la UI cuando todavía no hay clave), y persistir eso como
  // `issueKey` en un `.md` produciría un documento autoinconsistente —
  // `applyCanonicalContextIdentity` recompondría `fileName` como
  // `jira/Jira-issue.md`, que no es la ruta donde este archivo vive. Ningún
  // llamador de hoy pasa clave vacía (`materializeTabContext` la exige antes
  // de llamar; `issueKeyFor` siempre resuelve una clave real, del context o
  // del nombre de archivo), pero esta función no debe depender de que sigan
  // sin hacerlo.
  const normalized = issueKey.trim().toUpperCase()
  return `<!-- iaterminal:context ${JSON.stringify({
    id: canonicalContextId('jira', { issueKey: normalized }),
    name: canonicalContextName('jira', { issueKey: normalized }),
    kind: 'jira',
    icon: 'jira',
    // `id` canónico siempre queda en minúsculas: sin este campo,
    // `contextFromMetadata` + `applyCanonicalContextIdentity` reconstruirían
    // `issueKey` a partir de ese `id` (única fuente disponible si faltara) y
    // lo dejarían en minúsculas también. `issueKey` explícito evita esa
    // reconstrucción y conserva la forma real de la clave.
    issueKey: normalized,
  })} -->`
}

/**
 * Escapa caracteres especiales de regex para usarlos en nuevas expresiones regulares.
 * Solo es necesario aquí para derivar AUTO_RE de los marcadores importados.
 */
const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Construida dinámicamente desde los marcadores importados para asegurar sincronía:
 * si AUTO_START o AUTO_END cambian, la búsqueda se ajusta automáticamente.
 */
const AUTO_RE = new RegExp(
  `${escapeRegExp(AUTO_START)}[\\s\\S]*?${escapeRegExp(AUTO_END)}`
)

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

/**
 * ADF (Atlassian Document Format) → texto. La API v3 devuelve `description` y
 * los comentarios como árbol JSON; sin esto el `.md` acabaría con `[object Object]`.
 * Solo se aplanan los nodos que aparecen en un ticket normal.
 */
export function adfToText(node: unknown): string {
  if (typeof node === 'string') return node
  const record = asRecord(node)
  if (!record) return ''

  const children = Array.isArray(record.content) ? record.content : []
  const join = (separator: string): string =>
    children.map(child => adfToText(child)).filter(Boolean).join(separator)

  switch (record.type) {
    case 'text':
      return typeof record.text === 'string' ? record.text : ''
    case 'hardBreak':
      return '\n'
    case 'paragraph':
    case 'heading':
      return join('')
    case 'listItem':
      return `- ${join(' ')}`
    case 'bulletList':
    case 'orderedList':
      return join('\n')
    case 'codeBlock':
      return `\`\`\`\n${join('')}\n\`\`\``
    default:
      return join('\n\n')
  }
}

function commentBlock(issue: JiraIssueSnapshot, maxComments: number): string {
  // Los más recientes: Jira los devuelve en orden ascendente.
  const recent = maxComments > 0 ? issue.comments.slice(-maxComments) : issue.comments
  if (!recent.length) return ''
  const body = recent
    .map(comment => `**${comment.author}** · ${comment.created}\n${comment.body.trim()}`)
    .join('\n\n')
  return `## Comentarios\n${body}`
}

function linksBlock(issue: JiraIssueSnapshot): string {
  const lines = [
    ...issue.subtasks.map(sub => `- Subtarea \`${sub.key}\` · ${sub.summary} · ${sub.status}`),
    ...issue.links.map(link => `- ${link.type} \`${link.key}\` · ${link.summary}`),
    `- Jira: ${issue.url}`,
  ]
  return `## Enlaces y subtareas\n${lines.join('\n')}`
}

/**
 * El cuerpo de `iaterminal:auto`. Cada `##` es una clave de sección pedible por
 * `need-sections`, así que el corte por bloques es la unidad de presupuesto.
 */
export function issueAutoMarkdown(issue: JiraIssueSnapshot, maxComments: number): string {
  const meta = [
    `Estado: ${issue.status}`,
    `Tipo: ${issue.issueType}`,
    ...(issue.priority ? [`Prioridad: ${issue.priority}`] : []),
  ].join(' · ')
  const people = [
    `Asignada a: ${issue.assignee ?? 'sin asignar'}`,
    ...(issue.sprint ? [`Sprint: ${issue.sprint}`] : []),
    `Actualizada: ${issue.updated}`,
  ].join(' · ')

  const blocks = [
    `## Resumen\n${issue.key} · ${issue.summary}\n${meta}\n${people}`,
    `## Descripción\n${issue.description.trim() || '(sin descripción)'}`,
    ...(issue.acceptanceCriteria?.trim()
      ? [`## Criterios de aceptación\n${issue.acceptanceCriteria.trim()}`]
      : []),
    commentBlock(issue, maxComments),
    linksBlock(issue),
  ]
  return blocks.filter(Boolean).join('\n\n')
}

/**
 * Reemplaza SOLO la región `auto`. Si el archivo no existe todavía, escribe el
 * documento completo con una región `notes` vacía lista para anotar. Si existe
 * pero la región auto está corrupta/ausente, preserva el contenido existente (que
 * puede contener anotaciones valiosas) e inserta la nueva región al final.
 */
export function withJiraAutoBlock(raw: string, metadataLine: string, auto: string): string {
  const region = `${AUTO_START}\n${auto.trim()}\n${AUTO_END}`
  if (AUTO_RE.test(raw)) return raw.replace(AUTO_RE, region)
  if (raw.trim()) return `${raw.replace(/\s*$/, '')}\n\n${region}\n`
  return [
    metadataLine,
    region,
    '',
    `${NOTES_START}\n${NOTES_PLACEHOLDER}\n${NOTES_END}`,
    '',
  ].join('\n')
}

/**
 * El lado lector de `issueAutoMarkdown`: mismo bloque, al revés.
 *
 * `issueAutoMarkdown` escribe `## Resumen` como
 * `${key} · ${summary}\nEstado: ${status} · Tipo: ${issueType}[ · Prioridad: ${priority}]\n...`.
 * `Estado:` siempre va seguido de `· Tipo:` (issueType no es opcional), así que
 * anclar ahí es más preciso que cortar en el primer `·`, que el resumen puede
 * traer dentro de su propio texto.
 */
const RESUMEN_TITLE_RE = /^[A-Z][A-Z0-9]*-\d+\s*·\s*(.+)$/
const RESUMEN_STATUS_RE = /^Estado:\s*(.+?)\s*·\s*Tipo:/

/**
 * Resumen y estado desde el bloque `## Resumen` de la región `auto` (ya
 * extraída, ver `parseJiraIssuePreview`). `null` si el bloque falta o no
 * calza con el formato de `issueAutoMarkdown` — mejor sin dato que un resumen
 * inventado (Tarea 11).
 */
export function parseJiraResumenBlock(auto: string): { summary: string; status: string } | null {
  const section = markdownSections(auto).find(entry => entry.label === 'Resumen')
  if (!section) return null
  const [, titleLine = '', metaLine = ''] = section.content.split('\n')
  const summary = RESUMEN_TITLE_RE.exec(titleLine.trim())?.[1]?.trim()
  const status = RESUMEN_STATUS_RE.exec(metaLine.trim())?.[1]?.trim()
  if (!summary || !status) return null
  return { summary, status }
}

export interface JiraIssuePreview {
  /** Región `iaterminal:auto` vacía o ausente: snapshot placeholder, nunca refrescado. */
  stale: boolean
  summary?: string
  status?: string
}

/**
 * Lee resumen/estado/frescura del `.md` ya materializado por
 * `previewTabContext` (mismo IPC que usa cualquier preview de contexto; sin
 * llamada nueva, sin lectura de disco propia — la usa el renderer sobre el
 * `content` que ya recibió). La regla de frescura es la misma que aplica el
 * refresher antes del turno (`hasEmptyAutoRegion`, `electron/jiraContextRefresh.ts`):
 * región `auto` vacía o ausente = placeholder sin refrescar todavía.
 */
export function parseJiraIssuePreview(rawContent: string): JiraIssuePreview {
  const auto = extractSection(rawContent, AUTO_START, AUTO_END)
  if (!auto) return { stale: true }
  const block = parseJiraResumenBlock(auto)
  return block ? { stale: false, ...block } : { stale: false }
}
