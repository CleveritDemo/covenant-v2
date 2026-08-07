export type GitHubActionsErrorCode =
  | 'not_repo'
  | 'not_github'
  | 'token_missing'
  | 'token_invalid'
  | 'api_failed'
  | 'invalid_cwd'

export interface GitHubRepoRef {
  owner: string
  repo: string
  fullName: string
}

export interface GitHubActionsRun {
  id: number
  title: string
  status: string
  conclusion: string | null
  headBranch: string
  event: string
  createdAt: string
  updatedAt: string
  url: string
}

/** Resultado de comprobar un token contra la API de GitHub. */
export type GitHubTokenCheck =
  | { ok: true; login: string; scopes: string[] }
  | { ok: false; error: string }

export interface GitHubActionsSnapshot {
  ok: boolean
  repo: GitHubRepoRef | null
  runs: GitHubActionsRun[]
  error?: string
  errorCode?: GitHubActionsErrorCode
}
