/**
 * Contrato del picker de repos de GitHub (IPC `github:reposList`).
 * El canal nunca rechaza: los fallos van en `error`.
 */

export interface GithubRepoOption {
  fullName: string
  cloneUrl: string
  isPrivate: boolean
  archived: boolean
  pushedAt: string
  description: string
}

export interface GithubRepoListResult {
  repos: GithubRepoOption[]
  truncated: boolean
  error?: string
}
