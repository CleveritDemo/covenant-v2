/**
 * Lógica del canal IPC `github:reposList`. NUNCA lanza: `main.ts` valida el
 * `unknown` y delega aquí con tipos ya sanos.
 */

import type { GithubRepoListResult, GithubRepoOption } from '../src/shared/githubRepoPicker'
import { fetchGithubUserRepos, GitHubApiError, searchGithubRepos } from './githubApi'
import { describeFetchError } from './httpFetch'

const LIST_CACHE_TTL_MS = 60_000
const listCache = new Map<string, { at: number; result: GithubRepoListResult }>()

/** Vacía el listado sin query. Solo para tests. */
export function resetGithubRepoListCache(): void {
  listCache.clear()
}

function tokenMissing(token: string | null | undefined): boolean {
  return !((token ?? '').trim())
}

function finalize(repos: GithubRepoOption[]): GithubRepoOption[] {
  const seen = new Set<string>()
  return [...repos]
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .filter(repo => {
      const key = repo.fullName.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function mapListError(error: unknown): GithubRepoListResult {
  if (error instanceof GitHubApiError) {
    const message = error.status === 401
      ? 'Token de GitHub inválido o revocado.'
      : error.message
    return { repos: [], truncated: false, error: message }
  }
  return { repos: [], truncated: false, error: describeFetchError(error) }
}

export async function listGithubReposFor(
  token: string | null,
  query: string,
): Promise<GithubRepoListResult> {
  if (tokenMissing(token)) {
    return { repos: [], truncated: false, error: 'No hay token de GitHub para esta cuenta.' }
  }
  const trimmedToken = token!.trim()
  const trimmedQuery = (query ?? '').trim()
  const useSearch = trimmedQuery.length >= 2
  if (!useSearch) {
    const hit = listCache.get(trimmedToken)
    if (hit && Date.now() - hit.at <= LIST_CACHE_TTL_MS) return hit.result
  }

  try {
    const fetched = useSearch
      ? await searchGithubRepos(trimmedToken, trimmedQuery)
      : await fetchGithubUserRepos(trimmedToken)
    const result: GithubRepoListResult = {
      repos: finalize(fetched.repos),
      truncated: fetched.truncated,
    }
    if (!useSearch) listCache.set(trimmedToken, { at: Date.now(), result })
    return result
  } catch (error) {
    return mapListError(error)
  }
}
