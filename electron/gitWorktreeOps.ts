import { basename, isAbsolute, normalize, relative, resolve } from 'path'
import type {
  GitCurrentBranchResult,
  GitWorktreeAbortMergeResult,
  GitWorktreeAddRequest,
  GitWorktreeAddResult,
  GitWorktreeEntry,
  GitWorktreeMergeRequest,
  GitWorktreeMergeResult,
  GitWorktreeRemoveRequest,
  GitWorktreeRemoveResult,
} from '../src/shared/gitWorktree'
import { resolveWorkingDir, runGit, TIMEOUT_LOCAL_MS } from './gitSessionOps'

/**
 * Nombre de rama o segmento de path: sin `..`, sin espacios, sin caracteres de control
 * y sin empezar con `-` (rechaza flags como `--detach`/`--squash`/`--force`/`-x` inyectados
 * como si fueran datos posicionales — git los interpretaría como opciones).
 */
function isSafeSegment(value: string): boolean {
  const v = String(value ?? '').trim()
  if (!v) return false
  if (v.includes('..')) return false
  if (/\s/.test(v)) return false
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(v)) return false
  if (v.startsWith('-')) return false
  return true
}

/** Carpeta base permitida para worktrees: `<baseCwd>/.gravity/worktrees`. */
function worktreeBaseDir(baseCwd: string): string {
  return resolve(baseCwd, '.gravity', 'worktrees')
}

/**
 * Resuelve y valida `worktreePathRaw`: sin `..`/control chars, basename no puede empezar
 * con `-`, y el path resuelto debe quedar DENTRO de `<baseCwd>/.gravity/worktrees/`.
 * Devuelve `null` si algo no cumple.
 */
function resolveSafeWorktreePath(baseCwd: string, worktreePathRaw: string): string | null {
  const trimmed = String(worktreePathRaw ?? '').trim()
  if (!trimmed) return null
  if (trimmed.includes('..')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null

  const resolved = resolve(baseCwd, normalize(trimmed))
  const base = worktreeBaseDir(baseCwd)
  const relToBase = relative(base, resolved)
  if (relToBase === '..' || relToBase.startsWith(`..${'/'}`) || isAbsolute(relToBase)) return null

  if (!isSafeSegment(basename(resolved))) return null
  return resolved
}

async function isGitRepo(baseCwd: string): Promise<boolean> {
  const r = await runGit(baseCwd, ['rev-parse', '--is-inside-work-tree'], TIMEOUT_LOCAL_MS)
  return r.ok && r.stdout.trim() === 'true'
}

export async function gitCurrentBranch(baseCwdRaw: string): Promise<GitCurrentBranchResult> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  if (!baseCwd) return { ok: false, branch: '', error: 'cwd inválido' }
  if (!(await isGitRepo(baseCwd))) return { ok: false, branch: '', error: 'no es un repositorio git' }
  const r = await runGit(baseCwd, ['rev-parse', '--abbrev-ref', 'HEAD'], TIMEOUT_LOCAL_MS)
  if (!r.ok) return { ok: false, branch: '', error: r.stderr || 'error al obtener la rama' }
  return { ok: true, branch: r.stdout.trim() }
}

export async function gitWorktreeAdd(
  baseCwdRaw: string,
  request: GitWorktreeAddRequest,
): Promise<GitWorktreeAddResult> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  if (!baseCwd) return { ok: false, stdout: '', stderr: '', error: 'cwd inválido' }
  if (!(await isGitRepo(baseCwd))) {
    return { ok: false, stdout: '', stderr: '', error: 'no es un repositorio git' }
  }

  const worktreePathRaw = String(request?.worktreePath ?? '').trim()
  const branch = String(request?.branch ?? '').trim()
  const fromRef = String(request?.fromRef ?? '').trim()

  const worktreePath = resolveSafeWorktreePath(baseCwd, worktreePathRaw)
  if (!worktreePath || !isSafeSegment(branch) || !isSafeSegment(fromRef)) {
    return { ok: false, stdout: '', stderr: '', error: 'parámetros inválidos' }
  }

  // `--` separa las opciones (`-b <branch>`) de los posicionales (path, ref): cierra
  // cualquier vector de inyección si `worktreePath`/`fromRef` empezaran con `-` (además
  // ya bloqueado por resolveSafeWorktreePath/isSafeSegment — defensa en profundidad).
  const r = await runGit(
    baseCwd,
    ['worktree', 'add', '-b', branch, '--', worktreePath, fromRef],
    TIMEOUT_LOCAL_MS,
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr, error: r.ok ? undefined : r.stderr }
}

export async function gitWorktreeMerge(
  baseCwdRaw: string,
  request: GitWorktreeMergeRequest,
): Promise<GitWorktreeMergeResult> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  if (!baseCwd) return { ok: false, conflicted: false, conflictFiles: [], stdout: '', stderr: 'cwd inválido' }
  if (!(await isGitRepo(baseCwd))) {
    return { ok: false, conflicted: false, conflictFiles: [], stdout: '', stderr: 'no es un repositorio git' }
  }

  const branch = String(request?.branch ?? '').trim()
  const message = String(request?.message ?? '').trim()
  if (!isSafeSegment(branch) || !message) {
    return { ok: false, conflicted: false, conflictFiles: [], stdout: '', stderr: 'parámetros inválidos' }
  }

  // `--` separa opciones (`--no-ff`, `-m <message>`) del posicional `<branch>`: aunque
  // isSafeSegment ya rechaza valores que empiezan con `-`, esto añade una segunda capa.
  const merge = await runGit(baseCwd, ['merge', '--no-ff', '-m', message, '--', branch], TIMEOUT_LOCAL_MS)
  let conflictFiles: string[] = []
  if (!merge.ok) {
    const diff = await runGit(baseCwd, ['diff', '--name-only', '--diff-filter=U'], TIMEOUT_LOCAL_MS)
    conflictFiles = diff.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  }

  return {
    ok: merge.ok,
    conflicted: !merge.ok && conflictFiles.length > 0,
    conflictFiles,
    stdout: merge.stdout,
    stderr: merge.stderr,
  }
}

export async function gitWorktreeAbortMerge(baseCwdRaw: string): Promise<GitWorktreeAbortMergeResult> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  if (!baseCwd) return { ok: false, stdout: '', stderr: 'cwd inválido' }
  if (!(await isGitRepo(baseCwd))) return { ok: false, stdout: '', stderr: 'no es un repositorio git' }

  const r = await runGit(baseCwd, ['merge', '--abort'], TIMEOUT_LOCAL_MS)
  // Idempotente: si no hay merge en curso, git falla pero no debe romper el flujo.
  return { ok: true, stdout: r.stdout, stderr: r.stderr }
}

export async function gitWorktreeRemove(
  baseCwdRaw: string,
  request: GitWorktreeRemoveRequest,
): Promise<GitWorktreeRemoveResult> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  const steps = { removed: false, branchDeleted: false, pruned: false }
  if (!baseCwd) return { ok: false, steps, stderr: 'cwd inválido' }
  if (!(await isGitRepo(baseCwd))) return { ok: false, steps, stderr: 'no es un repositorio git' }

  const worktreePathRaw = String(request?.worktreePath ?? '').trim()
  const branch = String(request?.branch ?? '').trim()
  const stderrParts: string[] = []

  const worktreePath = resolveSafeWorktreePath(baseCwd, worktreePathRaw)
  if (worktreePath) {
    const rmResult = await runGit(
      baseCwd,
      ['worktree', 'remove', '--force', '--', worktreePath],
      TIMEOUT_LOCAL_MS,
    )
    steps.removed = rmResult.ok
    if (!rmResult.ok && rmResult.stderr) stderrParts.push(rmResult.stderr)
  } else {
    stderrParts.push('worktreePath inválido, se omite worktree remove')
  }

  if (branch && isSafeSegment(branch)) {
    const branchResult = await runGit(baseCwd, ['branch', '-D', '--', branch], TIMEOUT_LOCAL_MS)
    steps.branchDeleted = branchResult.ok
    if (!branchResult.ok && branchResult.stderr) stderrParts.push(branchResult.stderr)
  } else {
    stderrParts.push('branch inválida, se omite branch -D')
  }

  const pruneResult = await runGit(baseCwd, ['worktree', 'prune'], TIMEOUT_LOCAL_MS)
  steps.pruned = pruneResult.ok
  if (!pruneResult.ok && pruneResult.stderr) stderrParts.push(pruneResult.stderr)

  return {
    ok: steps.removed && steps.branchDeleted && steps.pruned,
    steps,
    stderr: stderrParts.join('\n'),
  }
}

function parseWorktreeList(stdout: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = []
  let current: Partial<GitWorktreeEntry> | null = null

  const flush = (): void => {
    if (current && current.path) {
      entries.push({
        path: current.path,
        branch: current.branch ?? '',
        head: current.head ?? '',
      })
    }
    current = null
  }

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) {
      flush()
      current = { path: line.slice('worktree '.length).trim() }
    } else if (line.startsWith('HEAD ')) {
      if (current) current.head = line.slice('HEAD '.length).trim()
    } else if (line.startsWith('branch ')) {
      if (current) {
        const raw = line.slice('branch '.length).trim()
        current.branch = raw.replace(/^refs\/heads\//, '')
      }
    }
  }
  flush()

  return entries
}

export async function gitWorktreeList(baseCwdRaw: string): Promise<GitWorktreeEntry[]> {
  const baseCwd = resolveWorkingDir(baseCwdRaw)
  if (!baseCwd) return []
  if (!(await isGitRepo(baseCwd))) return []

  const r = await runGit(baseCwd, ['worktree', 'list', '--porcelain'], TIMEOUT_LOCAL_MS)
  if (!r.ok) return []
  return parseWorktreeList(r.stdout)
}
