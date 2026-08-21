import { spawn } from 'child_process'
import { promises as fs, existsSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import type {
  OrgWorkspaceCloneRepo,
  OrgWorkspaceCloneResult,
} from '../src/shared/orgWorkspaceClone'
import { diagnoseCloneError } from '../src/shared/orgWorkspaceCloneError'

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

/**
 * Nombre de carpeta destino para un repo: folderName saneado, o último segmento de repoFullName.
 */
export function resolveRepoDestName(
  repo: { repoFullName: string; folderName?: string },
): { ok: true; destName: string } | { ok: false; error: string } {
  const fullName = repo.repoFullName.trim()
  const customFolder = repo.folderName?.trim() ?? ''
  if (customFolder) {
    const safeFolder = sanitizeSlug(customFolder)
    if (!safeFolder) {
      return { ok: false, error: `invalid folder name for ${fullName}: ${customFolder}` }
    }
    return { ok: true, destName: safeFolder }
  }
  const destName = lastPathSegment(fullName)
  if (!destName || destName === '.' || destName === '..' || destName.includes('/') || destName.includes('\\')) {
    return { ok: false, error: `invalid repo name: ${fullName}` }
  }
  return { ok: true, destName }
}

/** Normaliza URLs de repo para comparar origen (https/ssh, .git, userinfo, host case). */
export function sameRepoUrl(a: string, b: string): boolean {
  return normalizeRepoUrl(a) === normalizeRepoUrl(b)
}

function normalizeRepoUrl(raw: string): string {
  const trimmed = raw.trim()
  const ssh = /^git@([^:]+):(.+)$/i.exec(trimmed)
  if (ssh) {
    const host = ssh[1].toLowerCase()
    let path = ssh[2]
    path = path.replace(/\.git$/i, '').replace(/\/+$/, '')
    return `${host}/${path}`
  }

  let s = trimmed.replace(/^(https?:\/\/)([^/@]+@)/i, '$1')
  try {
    const u = new URL(s)
    const host = u.hostname.toLowerCase()
    let path = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '')
    if (path.startsWith('/')) path = path.slice(1)
    return `${host}/${path}`
  } catch {
    let fallback = s.replace(/^https?:\/\//i, '')
    fallback = fallback.replace(/\.git$/i, '').replace(/\/+$/, '')
    const slash = fallback.indexOf('/')
    if (slash < 0) return fallback.toLowerCase()
    return `${fallback.slice(0, slash).toLowerCase()}/${fallback.slice(slash + 1)}`
  }
}

function redactSecret(text: string, token: string): string {
  if (!token) return text
  return text.split(token).join('***')
}

function failResult(
  error: string,
  opts?: { workspaceDir?: string; repoFullName?: string; diagnoseRaw?: string },
): OrgWorkspaceCloneResult {
  const diagnoseRaw = opts?.diagnoseRaw ?? error
  return {
    ok: false,
    error,
    ...(opts?.workspaceDir !== undefined ? { workspaceDir: opts.workspaceDir } : {}),
    failure: diagnoseCloneError(diagnoseRaw, opts?.repoFullName),
  }
}

function authHeaderValue(token: string): string {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')
  return `AUTHORIZATION: basic ${basic}`
}

function runGit(
  args: string[],
  opts?: { extraHeader?: string },
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: { exitCode: number | null; stdout: string; stderr: string }): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const gitArgs = opts?.extraHeader
      ? ['-c', `http.extraHeader=${opts.extraHeader}`, ...args]
      : args

    const child = spawn('git', gitArgs, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err: Error) => {
      finish({ exitCode: null, stdout, stderr: err.message || String(err) })
    })
    child.on('close', code => {
      finish({ exitCode: code, stdout, stderr })
    })
  })
}

function runGitClone(
  cloneUrl: string,
  dest: string,
  token: string,
): Promise<{ exitCode: number | null; stderr: string }> {
  return runGit(['clone', '--depth', '1', cloneUrl, dest], {
    extraHeader: authHeaderValue(token),
  }).then(r => ({ exitCode: r.exitCode, stderr: r.stderr }))
}

function readRemoteOriginUrl(dest: string): Promise<string | null> {
  return runGit(['-C', dest, 'config', '--get', 'remote.origin.url']).then(r => {
    if (r.exitCode !== 0) return null
    const url = r.stdout.trim()
    return url || null
  })
}

async function findClonedElsewhere(workspaceDir: string, cloneUrl: string): Promise<string | null> {
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(workspaceDir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = join(workspaceDir, entry.name)
    if (!existsSync(join(dir, '.git'))) continue
    try {
      const origin = await readRemoteOriginUrl(dir)
      if (origin && sameRepoUrl(origin, cloneUrl)) return entry.name
    } catch {
      // sigue con la siguiente entrada
    }
  }
  return null
}

/**
 * Clona repos de un workspace org bajo `baseDir/orgSlug/workspaceSlug`.
 * Auth vía header git (no en la URL). Token nunca se incluye en errores.
 */
export async function cloneOrgWorkspace(
  params: OrgWorkspaceCloneParams,
): Promise<OrgWorkspaceCloneResult> {
  const orgSlug = sanitizeSlug(params.orgSlug)
  if (!orgSlug) return failResult('invalid-org-slug')
  const workspaceSlug = sanitizeSlug(params.workspaceSlug)
  if (!workspaceSlug) return failResult('invalid-workspace-slug')

  const token = params.token.trim()
  if (!token) return failResult('missing-token')

  const overrideDir = params.workspaceDir?.trim() ?? ''
  const baseDir = params.baseDir.trim()
  if (!overrideDir && !baseDir) return failResult('missing-default-dir')

  const workspaceDir = overrideDir || buildWorkspaceDir(baseDir, orgSlug, workspaceSlug)
  try {
    await fs.mkdir(workspaceDir, { recursive: true })
  } catch (e) {
    const msg = redactSecret(e instanceof Error ? e.message : String(e), token)
    return failResult(msg, { workspaceDir, diagnoseRaw: msg })
  }

  const destNameToRepos = new Map<string, string[]>()
  for (const repo of params.repos) {
    const resolved = resolveRepoDestName(repo)
    if (!resolved.ok) {
      const fullName = repo.repoFullName.trim()
      return failResult(resolved.error, {
        workspaceDir,
        ...(fullName ? { repoFullName: fullName } : {}),
      })
    }
    const fullName = repo.repoFullName.trim()
    const list = destNameToRepos.get(resolved.destName) ?? []
    list.push(fullName)
    destNameToRepos.set(resolved.destName, list)
  }
  for (const [destName, names] of destNameToRepos) {
    if (names.length > 1) {
      return failResult(`duplicate folder name '${destName}' for: ${names.join(', ')}`, {
        workspaceDir,
      })
    }
  }

  const cloned: string[] = []
  const skipped: string[] = []

  for (const repo of params.repos) {
    const fullName = repo.repoFullName.trim()
    const cloneUrl = repo.cloneUrl.trim()
    if (!fullName || !cloneUrl) {
      const error = `invalid repo entry: ${fullName || '(empty)'}`
      return failResult(error, {
        workspaceDir,
        ...(fullName ? { repoFullName: fullName } : {}),
      })
    }
    const resolved = resolveRepoDestName(repo)
    if (!resolved.ok) {
      return failResult(resolved.error, { workspaceDir, repoFullName: fullName })
    }
    const dest = join(workspaceDir, resolved.destName)
    if (existsSync(join(dest, '.git'))) {
      const origin = await readRemoteOriginUrl(dest)
      if (origin === null) {
        return failResult(`cannot verify repo in existing folder: ${dest}`, {
          workspaceDir,
          repoFullName: fullName,
        })
      }
      if (sameRepoUrl(origin, cloneUrl)) {
        skipped.push(fullName)
        continue
      }
      const redactedOrigin = redactSecret(origin, token)
      return failResult(`folder already has a different repo: ${dest} -> ${redactedOrigin}`, {
        workspaceDir,
        repoFullName: fullName,
        diagnoseRaw: redactedOrigin,
      })
    }
    const elsewhere = await findClonedElsewhere(workspaceDir, cloneUrl)
    if (elsewhere) {
      skipped.push(fullName)
      continue
    }

    const result = await runGitClone(cloneUrl, dest, token)
    if (result.exitCode !== 0) {
      const detail = redactSecret(result.stderr.trim() || `exit ${result.exitCode}`, token)
      return failResult(`clone failed for ${fullName}: ${detail}`, {
        workspaceDir,
        repoFullName: fullName,
        diagnoseRaw: detail,
      })
    }
    cloned.push(fullName)
  }

  return { ok: true, workspaceDir, cloned, skipped }
}
