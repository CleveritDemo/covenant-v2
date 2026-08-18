/**
 * Lógica de los tres canales IPC de issues de GitHub
 * (`githubIssue:status`, `githubIssue:search`, `githubIssue:preview`),
 * espejo de `jiraIpcOps.ts`. NUNCA lanza: `main.ts` valida el `unknown` y
 * delega aquí con tipos ya sanos.
 */

import type { GithubIssueRef } from '../src/shared/githubIssue'
import { githubIssueAutoMarkdown } from '../src/shared/githubIssueDoc'
import { githubFetch, githubGetIssue, GitHubApiError, searchGithubIssues } from './githubApi'
import { getRepoRoot, resolveGitHubRepo } from './githubActionsOps'
import { describeFetchError } from './httpFetch'
import { ensureIssueSnapshotsGitignore } from './jiraGitignore'

export interface GithubIssueStatus {
  connected: boolean
  repoFullName: string
  error?: string
}

export interface GithubIssueSearchResult {
  issues: GithubIssueRef[]
  error?: string
}

export interface GithubIssuePreviewResult {
  ok: boolean
  content?: string
  error?: string
}

const DISCONNECTED = (error: string, repoFullName = ''): GithubIssueStatus => ({
  connected: false,
  repoFullName,
  error,
})

const STATUS_PROBE_TTL_MS = 60_000
const statusProbeCache = new Map<string, { at: number; result: GithubIssueStatus }>()

function statusProbeCacheKey(repoFullName: string, token: string): string {
  return `${repoFullName}\u0000${token}`
}

/** Vacía el probe de status. Solo para tests. */
export function resetGithubIssueStatusCache(): void {
  statusProbeCache.clear()
}

function readStatusProbeCache(repoFullName: string, token: string): GithubIssueStatus | null {
  const hit = statusProbeCache.get(statusProbeCacheKey(repoFullName, token))
  if (!hit) return null
  if (Date.now() - hit.at > STATUS_PROBE_TTL_MS) {
    statusProbeCache.delete(statusProbeCacheKey(repoFullName, token))
    return null
  }
  return hit.result
}

function writeStatusProbeCache(repoFullName: string, token: string, result: GithubIssueStatus): void {
  statusProbeCache.set(statusProbeCacheKey(repoFullName, token), { at: Date.now(), result })
}

function mapProbeError(error: unknown, repoFullName: string): GithubIssueStatus {
  if (error instanceof GitHubApiError) {
    if (error.status === 401) {
      return DISCONNECTED('Token de GitHub inválido o revocado.', repoFullName)
    }
    if (error.status === 403) {
      return DISCONNECTED(error.message, repoFullName)
    }
    if (error.status === 404) {
      return DISCONNECTED(
        'La cuenta de GitHub del workspace no tiene acceso a este repositorio.',
        repoFullName,
      )
    }
    return DISCONNECTED(error.message, repoFullName)
  }
  return DISCONNECTED(describeFetchError(error), repoFullName)
}

async function probeRepoAccess(token: string, repoFullName: string): Promise<GithubIssueStatus> {
  const cached = readStatusProbeCache(repoFullName, token)
  if (cached) return cached

  const [owner, name] = repoFullName.split('/')
  let result: GithubIssueStatus
  try {
    await githubFetch(token, `https://api.github.com/repos/${owner}/${name}`)
    result = { connected: true, repoFullName }
  } catch (error) {
    result = mapProbeError(error, repoFullName)
  }
  writeStatusProbeCache(repoFullName, token, result)
  return result
}

function hasProject(cwd: string): boolean {
  return Boolean((cwd ?? '').trim())
}

function tokenMissing(token: string | null | undefined): boolean {
  return !((token ?? '').trim())
}

async function resolveWorkspaceRepo(cwd: string): Promise<
  { ok: true; repoFullName: string } | { ok: false; error: string }
> {
  if (!hasProject(cwd)) return { ok: false, error: 'No es un repositorio git.' }
  try {
    const repoRoot = await getRepoRoot(cwd)
    if (!repoRoot) return { ok: false, error: 'No es un repositorio git.' }
    const repo = await resolveGitHubRepo(repoRoot)
    if (!repo) return { ok: false, error: 'El remote origin no apunta a GitHub.' }
    return { ok: true, repoFullName: repo.fullName }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function githubIssueStatusFor(
  cwd: string,
  token: string | null | undefined,
): Promise<GithubIssueStatus> {
  const repo = await resolveWorkspaceRepo(cwd)
  if (!repo.ok) return DISCONNECTED(repo.error)
  if (tokenMissing(token)) return DISCONNECTED('Falta el token de GitHub.', repo.repoFullName)
  ensureIssueSnapshotsGitignore(cwd, 'github')
  return probeRepoAccess(token!.trim(), repo.repoFullName)
}

function asRef(issue: {
  number: number
  title: string
  state: 'open' | 'closed'
  repoFullName: string
  updated: string
  author: string
  labels: string[]
}): GithubIssueRef {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    repoFullName: issue.repoFullName,
    updated: issue.updated,
    author: issue.author,
    labels: issue.labels,
  }
}

export async function searchGithubIssuesQuick(
  cwd: string,
  token: string | null | undefined,
  query: string,
): Promise<GithubIssueSearchResult> {
  try {
    const repo = await resolveWorkspaceRepo(cwd)
    if (!repo.ok) return { issues: [], error: repo.error }
    if (tokenMissing(token)) return { issues: [], error: 'Falta el token de GitHub.' }
    const trimmed = (query ?? '').trim()
    if (/^\d+$/.test(trimmed)) {
      try {
        const exact = await githubGetIssue(token!.trim(), repo.repoFullName, Number(trimmed), 0)
        return { issues: [asRef(exact)] }
      } catch (error) {
        if (error instanceof GitHubApiError && error.status === 404) {
          return { issues: [] }
        }
        return { issues: [], error: error instanceof Error ? error.message : String(error) }
      }
    }
    const found = await searchGithubIssues(token!.trim(), repo.repoFullName, trimmed, 8)
    return { issues: found }
  } catch (error) {
    return { issues: [], error: error instanceof Error ? error.message : String(error) }
  }
}

export async function previewGithubIssue(
  cwd: string,
  token: string | null | undefined,
  number: number,
): Promise<GithubIssuePreviewResult> {
  try {
    if (!Number.isInteger(number) || number <= 0) {
      return { ok: false, error: 'Número de issue no válido.' }
    }
    const repo = await resolveWorkspaceRepo(cwd)
    if (!repo.ok) return { ok: false, error: repo.error }
    if (tokenMissing(token)) return { ok: false, error: 'Falta el token de GitHub.' }
    const issue = await githubGetIssue(token!.trim(), repo.repoFullName, number, 20)
    return { ok: true, content: githubIssueAutoMarkdown(issue, 20) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
