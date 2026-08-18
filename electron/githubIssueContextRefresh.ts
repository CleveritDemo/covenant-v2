/**
 * Refresca los snapshots vencidos de issues de GitHub ANTES de componer el
 * turno. Espejo de `jiraContextRefresh.ts`: misma ventana de castigo, mismo
 * presupuesto total, nunca lanza.
 */

import { dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { githubIssueFileStem, githubIssueRefFor } from '../src/shared/githubIssue'
import {
  githubContextMetadataLine,
  githubIssueAutoMarkdown,
  githubSnapshotHasContent,
  withGithubAutoBlock,
} from '../src/shared/githubIssueDoc'
import { isSnapshotStale } from '../src/shared/jiraIssue'
import { normalizeContextFileName, type TabContext } from '../src/shared/tabContext'
import { githubGetIssue } from './githubApi'
import { getRepoRoot, resolveGitHubRepo } from './githubActionsOps'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof githubGetIssue
  resolveRepo?: (cwd: string) => Promise<string>
  failureCooldownMs?: number
  budgetMs?: number
}

const FAILURE_COOLDOWN_MS = 5 * 60_000
const REFRESH_TOTAL_BUDGET_MS = 12_000
const DEFAULT_REFRESH_SECONDS = 900
const DEFAULT_MAX_COMMENTS = 20

const failures = new Map<string, number>()

export function clearGithubIssueRefreshFailures(): void {
  failures.clear()
}

async function withBudget(task: Promise<unknown>, budgetMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>(resolve => {
    timer = setTimeout(resolve, budgetMs)
    ;(timer as { unref?: () => void }).unref?.()
  })
  try {
    await Promise.race([task, budget])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function originRepoFullName(cwd: string): Promise<string> {
  const repoRoot = await getRepoRoot(cwd)
  if (!repoRoot) return ''
  const repo = await resolveGitHubRepo(repoRoot)
  return repo?.fullName ?? ''
}

export async function refreshStaleGithubIssueContexts(
  contexts: readonly TabContext[],
  cwd: string,
  token: string,
  deps: RefreshDeps = {},
): Promise<void> {
  const pending = contexts.filter(context => context.kind === 'githubIssue')
  if (!pending.length) return
  const trimmedToken = (token ?? '').trim()
  if (!trimmedToken) return

  const fetchIssue = deps.fetchIssue ?? githubGetIssue
  const cooldownMs = deps.failureCooldownMs ?? FAILURE_COOLDOWN_MS
  const now = Date.now()

  const refreshOne = async (context: TabContext): Promise<void> => {
    try {
      const ref = githubIssueRefFor(context)
      if (!ref.number) return
      const repoFullName = ref.repoFullName
        || (deps.resolveRepo ? await deps.resolveRepo(cwd) : await originRepoFullName(cwd))
      if (!repoFullName) return
      const failureKey = `${repoFullName}:${ref.number}`
      const failedAt = failures.get(failureKey)
      if (failedAt !== undefined && now - failedAt < cooldownMs) return

      const stem = githubIssueFileStem({
        ...context,
        repoFullName,
        issueNumber: ref.number,
      })
      const filePath = projectDirPath(cwd, 'github', normalizeContextFileName(stem, 'issue'))
      const mtimeMs = existsSync(filePath) ? statSync(filePath).mtimeMs : 0
      const currentContent = mtimeMs ? readFileSync(filePath, 'utf8') : ''
      const refreshSeconds = context.refreshSeconds ?? DEFAULT_REFRESH_SECONDS
      if (githubSnapshotHasContent(currentContent) && !isSnapshotStale(mtimeMs, refreshSeconds, now)) {
        return
      }

      const issue = await fetchIssue(trimmedToken, repoFullName, ref.number, DEFAULT_MAX_COMMENTS)
      const metadataLine = githubContextMetadataLine(repoFullName, ref.number)
      const latestContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
      const next = withGithubAutoBlock(
        latestContent,
        metadataLine,
        githubIssueAutoMarkdown(issue, DEFAULT_MAX_COMMENTS),
      )
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, next, 'utf8')
      failures.delete(failureKey)
    } catch (error) {
      const ref = githubIssueRefFor(context)
      const repoFullName = ref.repoFullName || 'origin'
      if (ref.number) failures.set(`${repoFullName}:${ref.number}`, now)
      console.warn(
        '[githubIssue] no se pudo refrescar el snapshot de',
        ref.number,
        '·',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  await withBudget(
    Promise.allSettled(pending.map(refreshOne)),
    deps.budgetMs ?? REFRESH_TOTAL_BUDGET_MS,
  )
}
