/**
 * El `.md` de una issue de GitHub: cómo se escribe y cómo se refresca sin
 * pisar las notas. Espejo de `jiraIssueDoc.ts`.
 */

import { AUTO_END, AUTO_START, extractSection, markdownSections, NOTES_END, NOTES_START } from './contextSections'
import type { GithubIssueSnapshot } from './githubIssue'
import { canonicalContextId, canonicalContextName } from './tabContext'

const NOTES_PLACEHOLDER = '(no annotations yet)'

/**
 * La línea `<!-- iaterminal:context ... -->` de un `.md` de githubIssue.
 * Un único punto de construcción para el refresher y para el alta sin snapshot.
 */
export function githubContextMetadataLine(repoFullName: string, issueNumber: number): string {
  const repo = repoFullName.trim()
  return `<!-- iaterminal:context ${JSON.stringify({
    id: canonicalContextId('githubIssue', { repoFullName: repo, issueNumber }),
    name: canonicalContextName('githubIssue', { repoFullName: repo, issueNumber }),
    kind: 'githubIssue',
    icon: 'github',
    issueNumber,
    ...(repo ? { repoFullName: repo } : {}),
  })} -->`
}

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const GITHUB_AUTO_RE = new RegExp(
  `${escapeRegExp(AUTO_START)}[\\s\\S]*?${escapeRegExp(AUTO_END)}`
)

function commentBlock(issue: GithubIssueSnapshot, maxComments: number): string {
  const recent = maxComments > 0 ? issue.comments.slice(-maxComments) : []
  if (!recent.length) return ''
  const body = recent
    .map(comment => `**${comment.author}** · ${comment.created}\n${comment.body.trim()}`)
    .join('\n\n')
  return `## Comentarios\n${body}`
}

/**
 * El cuerpo de `iaterminal:auto`. Cada `##` es una clave de sección pedible por
 * `need-sections`.
 */
export function githubIssueAutoMarkdown(issue: GithubIssueSnapshot, maxComments: number): string {
  const heading = issue.repoFullName
    ? `${issue.repoFullName}#${issue.number}`
    : `#${issue.number}`
  const meta = [
    `Estado: ${issue.state}`,
    `Autor: ${issue.author || 'desconocido'}`,
  ].join(' · ')
  const people = [
    `Asignada a: ${issue.assignees.length ? issue.assignees.join(', ') : 'sin asignar'}`,
    ...(issue.labels.length ? [`Labels: ${issue.labels.join(', ')}`] : []),
    ...(issue.milestone ? [`Milestone: ${issue.milestone}`] : []),
    `Actualizada: ${issue.updated}`,
  ].join(' · ')

  const blocks = [
    `## Resumen\n${heading} · ${issue.title}\n${meta}\n${people}`,
    `## Descripción\n${issue.body.trim() || '(sin descripción)'}`,
    commentBlock(issue, maxComments),
    `## Enlaces\n- GitHub: ${issue.url}`,
  ]
  return blocks.filter(Boolean).join('\n\n')
}

export function withGithubAutoBlock(raw: string, metadataLine: string, auto: string): string {
  const region = `${AUTO_START}\n${auto.trim()}\n${AUTO_END}`
  if (GITHUB_AUTO_RE.test(raw)) return raw.replace(GITHUB_AUTO_RE, region)
  if (raw.trim()) return `${raw.replace(/\s*$/, '')}\n\n${region}\n`
  return [
    metadataLine,
    region,
    '',
    `${NOTES_START}\n${NOTES_PLACEHOLDER}\n${NOTES_END}`,
    '',
  ].join('\n')
}

const RESUMEN_TITLE_RE = /#(\d+)\s*·\s*(.+)$/
const RESUMEN_STATUS_RE = /^Estado:\s*(.+?)\s*·\s*Autor:/
const RESUMEN_UPDATED_RE = /Actualizada:\s*(\S.*?)\s*$/

export function parseGithubResumenBlock(
  auto: string,
): { summary: string; status: string; updated?: string } | null {
  const section = markdownSections(auto).find(entry => entry.label === 'Resumen')
  if (!section) return null
  const [, titleLine = '', metaLine = '', peopleLine = ''] = section.content.split('\n')
  const summary = RESUMEN_TITLE_RE.exec(titleLine.trim())?.[2]?.trim()
  const status = RESUMEN_STATUS_RE.exec(metaLine.trim())?.[1]?.trim()
  if (!summary || !status) return null
  const updated = RESUMEN_UPDATED_RE.exec(peopleLine.trim())?.[1]?.trim()
  return updated ? { summary, status, updated } : { summary, status }
}

export function githubSnapshotHasContent(raw: string): boolean {
  return Boolean(extractSection(raw, AUTO_START, AUTO_END).trim())
}

export interface GithubIssuePreview {
  stale: boolean
  summary?: string
  status?: string
  updated?: string
}

export function parseGithubIssuePreview(rawContent: string): GithubIssuePreview {
  if (!githubSnapshotHasContent(rawContent)) return { stale: true }
  const auto = extractSection(rawContent, AUTO_START, AUTO_END)
  const block = parseGithubResumenBlock(auto)
  return block ? { stale: false, ...block } : { stale: false }
}
