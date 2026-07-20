import { spawn } from 'child_process'
import { normalize, resolve } from 'path'
import { statSync } from 'fs'
import { isDestructiveShellCommand } from '../src/shared/agentShellGuard'

const MAX_CMD_CHARS = 8000
const TIMEOUT_MS = 120_000
const MAX_STREAM_BYTES = 200_000

function resolveProjectDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

function shellExecutable(): { file: string; args: (cmd: string) => string[] } {
  if (process.platform === 'win32') {
    const com = process.env.ComSpec || 'cmd.exe'
    return { file: com, args: c => ['/d', '/s', '/c', c] }
  }
  const sh = process.env.SHELL || '/bin/zsh'
  return { file: sh, args: c => ['-lc', c] }
}

function validateCommand(cmd: string): string | null {
  const t = cmd.trim()
  if (!t) return 'empty command'
  if (t.includes('\0')) return 'disallowed characters'
  if (t.length > MAX_CMD_CHARS) return `command too long (>${MAX_CMD_CHARS} characters)`
  return null
}

export type AgentShellRunResult =
  | { ok: true; exitCode: number | null; stdout: string; stderr: string }
  | { ok: false; error: string }

export interface AgentShellRunOptions {
  /** True solo tras confirmación explícita del usuario en el renderer. */
  destructiveConfirmed?: boolean
}

/**
 * Ejecuta una línea de shell en `projectRoot` (cwd de la sesión), sin PTY interactivo.
 * Comandos destructivos requieren `destructiveConfirmed: true` (defense-in-depth).
 */
export function runAgentShellCommand(
  projectRoot: string,
  command: string,
  options?: AgentShellRunOptions,
): Promise<AgentShellRunResult> {
  const root = resolveProjectDir(projectRoot)
  if (!root) return Promise.resolve({ ok: false, error: 'invalid session cwd' })

  const err = validateCommand(command)
  if (err) return Promise.resolve({ ok: false, error: err })

  if (isDestructiveShellCommand(command) && !options?.destructiveConfirmed) {
    return Promise.resolve({
      ok: false,
      error: 'destructive command blocked (confirmation required)',
    })
  }

  const { file, args } = shellExecutable()
  const argv = args(command)

  return new Promise(resolvePromise => {
    let settled = false
    const finish = (r: AgentShellRunResult): void => {
      if (settled) return
      settled = true
      resolvePromise(r)
    }

    const child = spawn(file, argv, {
      cwd: root,
      env: { ...process.env, PWD: root } as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
        setTimeout(() => {
          try { child.kill('SIGKILL') } catch { /* ignore */ }
        }, 1500)
      } catch { /* ignore */ }
      if (!settled) {
        finish({ ok: false, error: `timeout (${Math.round(TIMEOUT_MS / 1000)}s)` })
      }
    }, TIMEOUT_MS)

    let out = ''
    let err = ''
    let outTrunc = false
    let errTrunc = false

    const cap = (prev: string, chunk: string): string => {
      const space = MAX_STREAM_BYTES - prev.length
      if (chunk.length <= space) return prev + chunk
      return prev + chunk.slice(0, Math.max(0, space)) + '\n[…output truncated…]'
    }

    child.stdout?.on('data', (buf: Buffer) => {
      const s = buf.toString('utf-8')
      const next = cap(out, s)
      if (next.length >= MAX_STREAM_BYTES && out.length < MAX_STREAM_BYTES) outTrunc = true
      out = next
    })
    child.stderr?.on('data', (buf: Buffer) => {
      const s = buf.toString('utf-8')
      const next = cap(err, s)
      if (next.length >= MAX_STREAM_BYTES && err.length < MAX_STREAM_BYTES) errTrunc = true
      err = next
    })

    child.on('error', (e: Error) => {
      clearTimeout(timer)
      finish({ ok: false, error: e.message })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (settled) return
      const note: string[] = []
      if (outTrunc || errTrunc) note.push('(output truncated by byte limit)')
      if (signal) note.push(`(signal: ${signal})`)
      const tail = note.length ? `\n${note.join(' ')}` : ''
      finish({
        ok: true,
        exitCode: code,
        stdout: out + tail,
        stderr: err,
      })
    })
  })
}
