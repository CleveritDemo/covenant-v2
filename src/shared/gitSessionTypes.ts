import type { GitErrorCode } from './gitErrorCodes'

/** Máximo de bytes devueltos para diff/stat en UI y para prompts de IA (truncado con sufijo). */
export const GIT_MAX_OUTPUT_BYTES = 200_000

/** Máximo de longitud del mensaje de `git commit -m`. */
export const GIT_MAX_COMMIT_MESSAGE_CHARS = 4096

export interface GitPathEntry {
  /** Ruta relativa al repo (puede incluir `->` en renombres en porcelana). */
  path: string
  /** Dos caracteres de estado índice/worktree (porcelana v1). */
  status: string
}

export interface GitRepoStatus {
  isRepo: boolean
  /** cwd de la sesión usado para resolver el repo */
  sessionCwd: string
  /** Raíz del repo (`git rev-parse --show-toplevel`) */
  repoRoot?: string
  /** Línea cruda `git status -sb` (primera línea, rama y tracking) */
  branchLine?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  files: GitPathEntry[]
  /** `git diff --stat` truncado */
  diffStat?: string
  /** `git diff --cached --stat` truncado */
  stagedDiffStat?: string
  /** `git diff --numstat` truncado (insertions/deletions por archivo) */
  diffNumStat?: string
  /** `git diff --cached --numstat` truncado */
  stagedDiffNumStat?: string
  hasStaged: boolean
  hasUnstaged: boolean
  /** Si no es repo o error al ejecutar git */
  error?: string
  errorCode?: GitErrorCode
}

export interface GitCommandResult {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  errorCode?: GitErrorCode
}

export interface GitDiffForAiPayload {
  ok: boolean
  text: string
  error?: string
}

/** Repo descubierto bajo la carpeta de proyecto (1 nivel). */
export interface GitListedRepo {
  name: string
  path: string
}

/** Repo local con su remoto origin, para publicar un workspace en una org. */
export interface GitRepoRemote {
  name: string
  path: string
  /** URL de `git remote get-url origin`; '' si no hay origin. */
  remoteUrl: string
  /** `owner/repo` normalizado desde remoteUrl; '' si no se pudo parsear. */
  repoFullName: string
}

/** Objetivo de operaciones git vía IPC: path directo o cwd de sesión. */
export interface GitTarget {
  sessionId?: string
  path?: string
}
