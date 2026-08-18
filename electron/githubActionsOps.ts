import { spawn } from 'child_process'
import { normalize, resolve } from 'path'
import { statSync } from 'fs'
import type {
  GitHubActionsErrorCode,
  GitHubActionsRun,
  GitHubActionsSnapshot,
  GitHubRepoRef,
  GitHubRunJobsResult,
} from '../src/shared/githubActionsTypes'
import { fetchRunJobs, fetchWorkflowRuns, GitHubApiError } from './githubApi'

const TIMEOUT_MS = 120_000
const RUN_LIST_LIMIT = 15

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

/** Parsea owner/repo desde URLs habituales de GitHub. */
export function parseGitHubRemoteUrl(raw: string): GitHubRepoRef | null {
  const s = raw.trim()
  if (!s) return null

  const ssh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(s)
  if (ssh) {
    const owner = ssh[1]
    const repo = ssh[2].replace(/\.git$/i, '')
    return { owner, repo, fullName: `${owner}/${repo}` }
  }

  try {
    const u = new URL(s)
    if (u.hostname.toLowerCase() !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/i, '')
    return { owner, repo, fullName: `${owner}/${repo}` }
  } catch {
    return null
  }
}

function spawnCapture(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number },
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: { exitCode: number | null; stdout: string; stderr: string }): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env:
        cmd === 'git'
          ? ({ ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv)
          : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      finish({ exitCode: null, stdout: '', stderr: `timeout (${Math.round(options.timeoutMs / 1000)}s)` })
    }, options.timeoutMs)

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', err => {
      clearTimeout(timer)
      finish({ exitCode: null, stdout: '', stderr: err.message })
    })

    child.on('close', code => {
      clearTimeout(timer)
      finish({ exitCode: code, stdout, stderr })
    })
  })
}

export async function getRepoRoot(sessionCwd: string): Promise<string | null> {
  const r = await spawnCapture('git', ['rev-parse', '--show-toplevel'], { cwd: sessionCwd, timeoutMs: TIMEOUT_MS })
  if (r.exitCode !== 0) return null
  const root = r.stdout.trim().split('\n')[0]?.trim()
  return root || null
}

export async function resolveGitHubRepo(repoRoot: string): Promise<GitHubRepoRef | null> {
  const r = await spawnCapture('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, timeoutMs: TIMEOUT_MS })
  if (r.exitCode !== 0) return null
  const url = r.stdout.trim().split('\n')[0]?.trim() ?? ''
  return parseGitHubRemoteUrl(url)
}

function fail(
  errorCode: GitHubActionsErrorCode,
  error: string,
  repo: GitHubRepoRef | null = null,
): GitHubActionsSnapshot {
  return { ok: false, repo, runs: [], error, errorCode }
}

/**
 * Jobs y steps de un run. Va aparte del listado: sólo se pide cuando el usuario
 * despliega una fila, no una vez por run listado en cada refresco.
 */
export async function githubRunJobsForSession(
  sessionCwdRaw: string,
  githubToken: string | null,
  runId: number,
): Promise<GitHubRunJobsResult> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) return { ok: false, jobs: [], error: 'cwd inválido' }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) return { ok: false, jobs: [], error: 'no es un repositorio git' }

  const repo = await resolveGitHubRepo(repoRoot)
  if (!repo) return { ok: false, jobs: [], error: 'El remote origin no apunta a GitHub.' }

  const token = githubToken?.trim()
  if (!token) return { ok: false, jobs: [], error: 'Falta el token de GitHub.' }

  try {
    return { ok: true, jobs: await fetchRunJobs(token, repo.fullName, runId) }
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      // El run existe en el listado pero sus jobs caducaron: no es un error a gritar.
      return { ok: true, jobs: [] }
    }
    return { ok: false, jobs: [], error: error instanceof Error ? error.message : String(error) }
  }
}

export async function githubActionsListForSession(
  sessionCwdRaw: string,
  githubToken: string | null,
): Promise<GitHubActionsSnapshot> {
  const sessionCwd = resolveWorkingDir(sessionCwdRaw)
  if (!sessionCwd) {
    return fail('invalid_cwd', 'cwd inválido')
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return fail('not_repo', 'no es un repositorio git')
  }

  const repo = await resolveGitHubRepo(repoRoot)
  if (!repo) {
    return fail('not_github', 'El remote origin no apunta a un repositorio de GitHub.')
  }

  const token = githubToken?.trim()
  if (!token) {
    return fail(
      'token_missing',
      'Configura un token de GitHub en Ajustes o define GITHUB_TOKEN en el entorno.',
      repo,
    )
  }

  try {
    const runs: GitHubActionsRun[] = await fetchWorkflowRuns(token, repo.fullName, RUN_LIST_LIMIT)
    return { ok: true, repo, runs }
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.status === 401) {
        return fail('token_invalid', 'Token de GitHub inválido o revocado.', repo)
      }
      if (error.status === 403) {
        return fail('api_failed', error.message, repo)
      }
      if (error.status === 404) {
        return { ok: true, repo, runs: [] }
      }
      return fail('api_failed', error.message, repo)
    }
    const msg = error instanceof Error ? error.message : String(error)
    return fail('api_failed', msg, repo)
  }
}
