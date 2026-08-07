import { spawn } from 'child_process'
import { promises as fs, existsSync } from 'fs'
import { basename, join } from 'path'
import type {
  OrgWorkspaceCloneRepo,
  OrgWorkspaceCloneResult,
} from '../src/shared/orgWorkspaceClone'

export type {
  OrgWorkspaceCloneRepo,
  OrgWorkspaceCloneResult,
} from '../src/shared/orgWorkspaceClone'

const SLUG_RE = /^[A-Za-z0-9._-]+$/

export type OrgWorkspaceCloneParams = {
  baseDir: string
  orgSlug: string
  workspaceSlug: string
  repos: Array<OrgWorkspaceCloneRepo>
  token: string
  /** Destino final opcional (p. ej. carpeta elegida en el picker). */
  workspaceDir?: string
}

/** Solo [A-Za-z0-9._-]; null si vacío o path-traversal. */
export function sanitizeSlug(raw: string): string | null {
  const s = raw.trim()
  if (!s || s === '.' || s === '..' || !SLUG_RE.test(s)) return null
  return s
}

export function lastPathSegment(repoFullName: string): string {
  const trimmed = repoFullName.trim().replace(/\/+$/, '')
  const seg = basename(trimmed)
  return seg || trimmed
}

export function buildWorkspaceDir(baseDir: string, orgSlug: string, workspaceSlug: string): string {
  return join(baseDir, orgSlug, workspaceSlug)
}

function redactSecret(text: string, token: string): string {
  if (!token) return text
  return text.split(token).join('***')
}

function authHeaderValue(token: string): string {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')
  return `AUTHORIZATION: basic ${basic}`
}

function runGitClone(
  cloneUrl: string,
  dest: string,
  token: string,
): Promise<{ exitCode: number | null; stderr: string }> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: { exitCode: number | null; stderr: string }): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn(
      'git',
      [
        '-c',
        `http.extraHeader=${authHeaderValue(token)}`,
        'clone',
        '--depth',
        '1',
        cloneUrl,
        dest,
      ],
      {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err: Error) => {
      finish({ exitCode: null, stderr: err.message || String(err) })
    })
    child.on('close', code => {
      finish({ exitCode: code, stderr })
    })
  })
}

/**
 * Clona repos de un workspace org bajo `baseDir/orgSlug/workspaceSlug`.
 * Auth vía header git (no en la URL). Token nunca se incluye en errores.
 */
export async function cloneOrgWorkspace(
  params: OrgWorkspaceCloneParams,
): Promise<OrgWorkspaceCloneResult> {
  const orgSlug = sanitizeSlug(params.orgSlug)
  if (!orgSlug) return { ok: false, error: 'invalid-org-slug' }
  const workspaceSlug = sanitizeSlug(params.workspaceSlug)
  if (!workspaceSlug) return { ok: false, error: 'invalid-workspace-slug' }

  const token = params.token.trim()
  if (!token) return { ok: false, error: 'missing-token' }

  const overrideDir = params.workspaceDir?.trim() ?? ''
  const baseDir = params.baseDir.trim()
  if (!overrideDir && !baseDir) return { ok: false, error: 'missing-default-dir' }

  const workspaceDir = overrideDir || buildWorkspaceDir(baseDir, orgSlug, workspaceSlug)
  try {
    await fs.mkdir(workspaceDir, { recursive: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: redactSecret(msg, token), workspaceDir }
  }

  const cloned: string[] = []
  const skipped: string[] = []

  for (const repo of params.repos) {
    const fullName = repo.repoFullName.trim()
    const cloneUrl = repo.cloneUrl.trim()
    if (!fullName || !cloneUrl) {
      return {
        ok: false,
        error: `invalid repo entry: ${fullName || '(empty)'}`,
        workspaceDir,
      }
    }
    const destName = lastPathSegment(fullName)
    if (!destName || destName === '.' || destName === '..' || destName.includes('/') || destName.includes('\\')) {
      return { ok: false, error: `invalid repo name: ${fullName}`, workspaceDir }
    }
    const dest = join(workspaceDir, destName)
    if (existsSync(join(dest, '.git'))) {
      skipped.push(fullName)
      continue
    }

    const result = await runGitClone(cloneUrl, dest, token)
    if (result.exitCode !== 0) {
      const detail = redactSecret(result.stderr.trim() || `exit ${result.exitCode}`, token)
      return {
        ok: false,
        error: `clone failed for ${fullName}: ${detail}`,
        workspaceDir,
      }
    }
    cloned.push(fullName)
  }

  return { ok: true, workspaceDir, cloned, skipped }
}
