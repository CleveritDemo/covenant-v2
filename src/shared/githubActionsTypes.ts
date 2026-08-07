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

export interface GitHubJobStep {
  number: number
  name: string
  status: string
  conclusion: string | null
  /** `null` mientras el step no ha arrancado (job en cola). */
  startedAt: string | null
  /** `null` mientras sigue corriendo. */
  completedAt: string | null
}

export interface GitHubJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
  url: string
  steps: GitHubJobStep[]
}

/** Jobs de un run: petición aparte, no un campo de `GitHubActionsRun`. */
export interface GitHubRunJobsResult {
  ok: boolean
  jobs: GitHubJob[]
  error?: string
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
