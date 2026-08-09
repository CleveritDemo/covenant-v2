import { spawn } from 'child_process'
import { basename, join, normalize, resolve } from 'path'
import { readdirSync, realpathSync, statSync } from 'fs'
import type {
  GitCommandResult,
  GitDiffForAiPayload,
  GitListedRepo,
  GitPathEntry,
  GitRepoStatus,
} from '../src/shared/gitSessionTypes'
import {
  GIT_MAX_COMMIT_MESSAGE_CHARS,
  GIT_MAX_OUTPUT_BYTES,
} from '../src/shared/gitSessionTypes'
import { GIT_ERROR_CODES } from '../src/shared/gitErrorCodes'

export const TIMEOUT_LOCAL_MS = 120_000
const TIMEOUT_NETWORK_MS = 900_000

export function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

/** `.git` como directorio o archivo (worktree / submodule). */
function hasGitMarker(dir: string): boolean {
  try {
    const st = statSync(join(dir, '.git'))
    return st.isDirectory() || st.isFile()
  } catch {
    return false
  }
}

/**
 * Descubre repos git a 1 nivel: el root (si tiene `.git`) + subdirs inmediatos.
 * Sin recursión ni symlinks.
 */
export function gitListRepos(dirPathRaw: string): GitListedRepo[] {
  const dir = resolveWorkingDir(dirPathRaw)
  if (!dir) return []
  const out: GitListedRepo[] = []
  if (hasGitMarker(dir)) {
    out.push({ name: basename(dir), path: dir })
  }
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue
    const child = join(dir, entry.name)
    if (!hasGitMarker(child)) continue
    out.push({ name: basename(child), path: child })
  }
  return out
}

function normalizeRepoPath(pathRaw: string): string {
  const resolved = resolve(normalize(pathRaw))
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

/**
 * Une repos de varias raíces (projectFolder + CWDs de terminal).
 * Por path: `gitListRepos` (1 nivel) + raíz real vía `rev-parse` si aplica.
 * Dedupe por path normalizado; orden = primera aparición (project primero).
 */
export async function gitCollectUniqueRepos(paths: string[]): Promise<GitListedRepo[]> {
  const byPath = new Map<string, GitListedRepo>()
  const add = (repo: GitListedRepo): void => {
    const key = normalizeRepoPath(repo.path)
    if (byPath.has(key)) return
    byPath.set(key, { name: basename(key), path: key })
  }

  for (const raw of paths) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) continue
    const dir = resolveWorkingDir(trimmed)
    if (!dir) continue
    for (const repo of gitListRepos(dir)) add(repo)
    const root = await getRepoRoot(dir)
    if (root) add({ name: basename(root), path: root })
  }
  return [...byPath.values()]
}

function capOutput(s: string, max = GIT_MAX_OUTPUT_BYTES): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n[…salida truncada…]`
}

export function runGit(
  cwd: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<GitCommandResult> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: GitCommandResult): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn('git', args as string[], {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {
            /* ignore */
          }
        }, 1500)
      } catch {
        /* ignore */
      }
      if (!settled) {
        finish({
          ok: false,
          exitCode: null,
          stdout: '',
          stderr: `timeout (${Math.round(timeoutMs / 1000)}s)`,
          errorCode: GIT_ERROR_CODES.TIMEOUT,
        })
      }
    }, timeoutMs)

    let out = ''
    let err = ''

    const cap = (prev: string, chunk: string): string => {
      const space = GIT_MAX_OUTPUT_BYTES - prev.length
      if (chunk.length <= space) return prev + chunk
      return prev + chunk.slice(0, Math.max(0, space)) + '\n[…truncado…]'
    }

    child.stdout?.on('data', (buf: Buffer) => {
      out = cap(out, buf.toString('utf-8'))
    })
    child.stderr?.on('data', (buf: Buffer) => {
      err = cap(err, buf.toString('utf-8'))
    })

    child.on('error', (e: Error) => {
      clearTimeout(timer)
      finish({ ok: false, exitCode: null, stdout: out, stderr: e.message || String(e) })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (settled) return
      const sigNote = signal ? `\n(signal: ${signal})` : ''
      finish({
        ok: code === 0,
        exitCode: code,
        stdout: out + sigNote,
        stderr: err,
      })
    })
  })
}

export async function getRepoRoot(sessionCwd: string): Promise<string | null> {
  const r = await runGit(sessionCwd, ['rev-parse', '--show-toplevel'], TIMEOUT_LOCAL_MS)
  if (r.exitCode !== 0) return null
  const root = r.stdout.trim().split('\n')[0]?.trim()
  return root || null
}

/** Parsea la primera línea de `git status -sb` (## …). */
function parseBranchLine(line: string): Pick<GitRepoStatus, 'branch' | 'upstream' | 'ahead' | 'behind'> {
  if (!line.startsWith('## ')) {
    return { branch: line.replace(/^##\s*/, '').trim() || 'unknown' }
  }
  const rest = line.slice(3).trim()
  const bracketIdx = rest.indexOf(' [')
  const core = bracketIdx >= 0 ? rest.slice(0, bracketIdx) : rest
  let ahead: number | undefined
  let behind: number | undefined
  if (bracketIdx >= 0) {
    const inside = rest.slice(bracketIdx + 2, rest.lastIndexOf(']'))
    const aheadM = /ahead (\d+)/.exec(inside)
    const behindM = /behind (\d+)/.exec(inside)
    if (aheadM) ahead = Number(aheadM[1])
    if (behindM) behind = Number(behindM[1])
  }
  const dots = '...'
  const dotIdx = core.indexOf(dots)
  if (dotIdx >= 0) {
    return {
      branch: core.slice(0, dotIdx).trim() || 'HEAD',
      upstream: core.slice(dotIdx + dots.length).trim() || undefined,
      ahead,
      behind,
    }
  }
  return { branch: core.trim() || 'HEAD', ahead, behind }
}

function parsePorcelain(lines: string[]): GitPathEntry[] {
  const out: GitPathEntry[] = []
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    if (line.length < 4) continue
    const xy = line.slice(0, 2)
    const pathPart = line.slice(3)
    out.push({ status: xy, path: pathPart })
  }
  return out
}

function porcelainHasStaged(files: GitPathEntry[]): boolean {
  return files.some(f => f.status[0] !== ' ' && f.status[0] !== '?')
}

function porcelainHasUnstaged(files: GitPathEntry[]): boolean {
  return files.some(f => f.status[1] !== ' ')
}

export async function gitGetRepoStatus(sessionCwdRaw: string): Promise<GitRepoStatus> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      isRepo: false,
      sessionCwd: sessionCwdRaw.trim(),
      files: [],
      hasStaged: false,
      hasUnstaged: false,
      error: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      isRepo: false,
      sessionCwd,
      files: [],
      hasStaged: false,
      hasUnstaged: false,
      error: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }

  const [sb, por, stat, stagedStat, numStat, stagedNumStat] = await Promise.all([
    runGit(repoRoot, ['status', '-sb'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['status', '--porcelain=v1'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--stat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--cached', '--stat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--numstat'], TIMEOUT_LOCAL_MS),
    runGit(repoRoot, ['diff', '--cached', '--numstat'], TIMEOUT_LOCAL_MS),
  ])

  const sbLines = sb.stdout.split('\n').filter(Boolean)
  const branchLine = sbLines[0] ?? ''
  const branchInfo = parseBranchLine(branchLine)
  const files = parsePorcelain(por.stdout.split('\n').filter(Boolean))

  return {
    isRepo: true,
    sessionCwd,
    repoRoot,
    branchLine,
    ...branchInfo,
    files,
    diffStat: capOutput(stat.stdout, 80_000),
    stagedDiffStat: capOutput(stagedStat.stdout, 40_000),
    diffNumStat: capOutput(numStat.stdout, 80_000),
    stagedDiffNumStat: capOutput(stagedNumStat.stdout, 40_000),
    hasStaged: porcelainHasStaged(files),
    hasUnstaged: porcelainHasUnstaged(files),
  }
}

export async function gitDiffForAi(sessionCwdRaw: string): Promise<GitDiffForAiPayload> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return { ok: false, text: '', error: 'cwd inválido' }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return { ok: false, text: '', error: 'no es un repositorio git' }
  }

  const sb = await runGit(repoRoot, ['status', '-sb'], TIMEOUT_LOCAL_MS)
  const staged = await runGit(repoRoot, ['diff', '--cached'], TIMEOUT_LOCAL_MS)
  let budget = GIT_MAX_OUTPUT_BYTES - sb.stdout.length - 200
  let body = `${sb.stdout.trim()}\n\n--- staged (git diff --cached) ---\n${staged.stdout}`
  if (body.length > GIT_MAX_OUTPUT_BYTES - 5000) {
    body = capOutput(body, GIT_MAX_OUTPUT_BYTES - 5000)
    budget = Math.max(0, GIT_MAX_OUTPUT_BYTES - body.length - 100)
  }
  if (budget > 2000) {
    const unstaged = await runGit(repoRoot, ['diff'], TIMEOUT_LOCAL_MS)
    body += `\n\n--- unstaged (git diff) ---\n${capOutput(unstaged.stdout, budget)}`
  }
  return { ok: true, text: capOutput(body, GIT_MAX_OUTPUT_BYTES) }
}

export function validateCommitMessage(msg: unknown): string | null {
  if (typeof msg !== 'string') return 'mensaje inválido'
  const t = msg.replace(/\r\n/g, '\n').trim()
  if (!t) return 'mensaje vacío'
  if (t.includes('\0')) return 'caracteres no permitidos'
  if (t.length > GIT_MAX_COMMIT_MESSAGE_CHARS) {
    return `mensaje demasiado largo (máx. ${GIT_MAX_COMMIT_MESSAGE_CHARS})`
  }
  return null
}

export async function gitPull(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  return runGit(repoRoot, ['pull', '--ff-only'], TIMEOUT_NETWORK_MS)
}

export async function gitPush(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  return runGit(repoRoot, ['push'], TIMEOUT_NETWORK_MS)
}

export async function gitCommit(sessionCwdRaw: string, message: unknown): Promise<GitCommandResult> {
  const err = validateCommitMessage(message)
  if (err) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: err,
      errorCode: GIT_ERROR_CODES.INVALID_COMMIT_MESSAGE,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, exitCode: null, stdout: '', stderr: 'cwd inválido' }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, exitCode: null, stdout: '', stderr: 'no es un repositorio git' }
  const msg = String(message).replace(/\r\n/g, '\n').trim()
  return runGit(repoRoot, ['commit', '-m', msg], TIMEOUT_LOCAL_MS)
}

export async function gitStageAll(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['add', '-A'], TIMEOUT_LOCAL_MS)
}

export async function gitStageFile(sessionCwdRaw: string, relPathRaw: unknown): Promise<GitCommandResult> {
  const relPath = String(relPathRaw ?? '').trim().replace(/\\/g, '/')
  if (!relPath || relPath.includes('\0') || relPath.startsWith('/')) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'ruta inválida',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['add', '--', relPath], TIMEOUT_LOCAL_MS)
}

export async function gitUnstageAll(sessionCwdRaw: string): Promise<GitCommandResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['restore', '--staged', '.'], TIMEOUT_LOCAL_MS)
}

/** Área del diff pedido: índice, worktree, o archivo aún sin seguimiento. */
export type GitDiffArea = 'staged' | 'worktree' | 'untracked'

function invalidPath(): GitCommandResult {
  return {
    ok: false,
    exitCode: null,
    stdout: '',
    stderr: 'ruta inválida',
    errorCode: GIT_ERROR_CODES.CWD_INVALID,
  }
}

/** Normaliza y valida la ruta relativa igual que stage/unstage. */
function safeRelPath(relPathRaw: unknown): string | null {
  const relPath = String(relPathRaw ?? '').trim().replace(/\\/g, '/')
  if (!relPath || relPath.includes('\0') || relPath.startsWith('/')) return null
  return relPath
}

async function resolveRepoRootOrError(
  sessionCwdRaw: string,
): Promise<{ repoRoot: string } | { error: GitCommandResult }> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      error: {
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: 'cwd inválido',
        errorCode: GIT_ERROR_CODES.CWD_INVALID,
      },
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      error: {
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: 'no es un repositorio git',
        errorCode: GIT_ERROR_CODES.NOT_A_REPO,
      },
    }
  }
  return { repoRoot }
}

/** Diff de un solo archivo. El texto va en `stdout`, ya recortado por `runGit`. */
export async function gitDiffFile(
  sessionCwdRaw: string,
  relPathRaw: unknown,
  area: GitDiffArea,
): Promise<GitCommandResult> {
  const relPath = safeRelPath(relPathRaw)
  if (!relPath) return invalidPath()
  const resolved = await resolveRepoRootOrError(sessionCwdRaw)
  if ('error' in resolved) return resolved.error

  if (area === 'untracked') {
    // Un archivo sin seguimiento no tiene diff: se compara contra la nada para
    // enseñarlo como altas. `--no-index` sale con 1 cuando hay diferencias, que
    // aquí es el caso normal, no un fallo.
    // ponytail: usa /dev/null; en Windows sin git-bash esto puede fallar y el
    // panel enseñará el stderr. Si hace falta, el reemplazo es `git show :0:`.
    const r = await runGit(
      resolved.repoRoot,
      ['diff', '--no-index', '--', '/dev/null', relPath],
      TIMEOUT_LOCAL_MS,
    )
    return r.exitCode === 1 && r.stdout ? { ...r, ok: true } : r
  }

  const args = area === 'staged' ? ['diff', '--cached', '--', relPath] : ['diff', '--', relPath]
  return runGit(resolved.repoRoot, args, TIMEOUT_LOCAL_MS)
}

/**
 * Destructivo: descarta los cambios del worktree de un archivo. Los de un
 * archivo sin seguimiento se borran; los del índice no se tocan (para eso está
 * unstage). Quien llama debe confirmar antes.
 */
export async function gitDiscardFile(
  sessionCwdRaw: string,
  relPathRaw: unknown,
  untracked: boolean,
): Promise<GitCommandResult> {
  const relPath = safeRelPath(relPathRaw)
  if (!relPath) return invalidPath()
  const resolved = await resolveRepoRootOrError(sessionCwdRaw)
  if ('error' in resolved) return resolved.error

  const args = untracked ? ['clean', '-f', '--', relPath] : ['restore', '--', relPath]
  return runGit(resolved.repoRoot, args, TIMEOUT_LOCAL_MS)
}

export async function gitUnstageFile(sessionCwdRaw: string, relPathRaw: unknown): Promise<GitCommandResult> {
  const relPath = String(relPathRaw ?? '').trim().replace(/\\/g, '/')
  if (!relPath || relPath.includes('\0') || relPath.startsWith('/')) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'ruta inválida',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'cwd inválido',
      errorCode: GIT_ERROR_CODES.CWD_INVALID,
    }
  }
  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'no es un repositorio git',
      errorCode: GIT_ERROR_CODES.NOT_A_REPO,
    }
  }
  return runGit(repoRoot, ['restore', '--staged', '--', relPath], TIMEOUT_LOCAL_MS)
}
