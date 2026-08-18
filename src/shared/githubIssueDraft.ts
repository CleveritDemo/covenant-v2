import type { GithubIssueRef } from './githubIssue'
import {
  canonicalContextFileName,
  canonicalContextId,
  canonicalContextName,
  type TabContext,
} from './tabContext'

/**
 * Issue de GitHub → contexto `githubIssue` listo para guardar. `null` si
 * falta el número o el repo: sin ellos el refresco resuelve un `.md`
 * genérico que nunca existe, así que ese estado no puede llegar a guardarse.
 */
export function githubIssueDraftFromRef(issue: GithubIssueRef): TabContext | null {
  const issueNumber = issue.number
  const repoFullName = (issue.repoFullName ?? '').trim()
  if (!issueNumber || !repoFullName) return null
  return {
    id: canonicalContextId('githubIssue', { issueNumber, repoFullName }),
    name: canonicalContextName('githubIssue', { issueNumber, repoFullName }),
    fileName: canonicalContextFileName('githubIssue', { issueNumber, repoFullName }),
    kind: 'githubIssue',
    issueNumber,
    repoFullName,
  }
}
