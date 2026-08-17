import { spawn } from 'child_process'
import type { AppConfig } from '@shared/configSchema'

const CREDENTIAL_TIMEOUT_MS = 8_000

function spawnCapture(
  cmd: string,
  args: string[],
  options: { stdin?: string; timeoutMs: number },
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: { exitCode: number | null; stdout: string; stderr: string }): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn(cmd, args, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      finish({ exitCode: null, stdout: '', stderr: 'timeout' })
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

    if (options.stdin != null) {
      child.stdin?.write(options.stdin)
      child.stdin?.end()
    } else {
      child.stdin?.end()
    }
  })
}

function parseCredentialPassword(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    const m = /^password=(.+)$/.exec(line.trim())
    if (m?.[1]) return m[1].trim()
  }
  return null
}

/** Lee el PAT de GitHub guardado en el credential helper de git (p. ej. osxkeychain). */
export async function readGithubTokenFromGitCredential(): Promise<string | null> {
  const input = 'protocol=https\nhost=github.com\n\n'
  const r = await spawnCapture('git', ['credential', 'fill'], {
    stdin: input,
    timeoutMs: CREDENTIAL_TIMEOUT_MS,
  })
  if (r.exitCode !== 0) return null
  const token = parseCredentialPassword(r.stdout)
  return token || null
}

export type GithubTokenSource = 'settings' | 'env' | 'keychain' | 'none'

/**
 * Token efectivo para la API de GitHub.
 * Prioridad: config.json → GITHUB_TOKEN (env/.env) → credential helper de git.
 */
export async function resolveGithubTokenWithSource(
  config: AppConfig,
): Promise<{ token: string | null; source: GithubTokenSource }> {
  const fromConfig = config.githubToken?.trim()
  if (fromConfig) return { token: fromConfig, source: 'settings' }

  const fromEnv = process.env.GITHUB_TOKEN?.trim()
  if (fromEnv) return { token: fromEnv, source: 'env' }

  const fromKeychain = await readGithubTokenFromGitCredential()
  if (fromKeychain) return { token: fromKeychain, source: 'keychain' }

  return { token: null, source: 'none' }
}

export async function resolveGithubToken(config: AppConfig): Promise<string | null> {
  return (await resolveGithubTokenWithSource(config)).token
}
