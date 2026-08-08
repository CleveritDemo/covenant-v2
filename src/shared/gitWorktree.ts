/** Tipos compartidos (electron + renderer) para operaciones de `git worktree`. */

export interface GitCurrentBranchResult {
  ok: boolean
  branch: string
  error?: string
}

export interface GitWorktreeAddRequest {
  worktreePath: string
  branch: string
  fromRef: string
}

export interface GitWorktreeAddResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: string
}

export interface GitWorktreeMergeRequest {
  branch: string
  message: string
}

export interface GitWorktreeMergeResult {
  ok: boolean
  conflicted: boolean
  conflictFiles: string[]
  stdout: string
  stderr: string
}

export interface GitWorktreeAbortMergeResult {
  ok: boolean
  stdout: string
  stderr: string
}

export interface GitWorktreeRemoveRequest {
  worktreePath: string
  branch: string
  force?: boolean
}

export interface GitWorktreeRemoveResult {
  ok: boolean
  steps: {
    removed: boolean
    branchDeleted: boolean
    pruned: boolean
  }
  stderr: string
}

export interface GitWorktreeEntry {
  path: string
  branch: string
  head: string
}
