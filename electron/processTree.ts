import { execFile, type ChildProcess } from 'child_process'

/**
 * Mata un proceso y su árbol (grupo en posix, /T en win32).
 * En posix: SIGTERM al grupo, luego SIGKILL tras escalateAfterMs si sigue vivo.
 */
export function killProcessTree(
  proc: ChildProcess,
  options?: { escalateAfterMs?: number },
): void {
  if (!proc.pid || proc.exitCode !== null) return

  const pid = proc.pid

  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {
      /* swallow */
    })
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
      try {
        proc.kill('SIGTERM')
      } catch {
        /* already gone */
      }
    }
  }

  const escalateAfterMs = options?.escalateAfterMs ?? 3000
  const timer = setTimeout(() => {
    if (proc.exitCode !== null) return
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }, escalateAfterMs)
  timer.unref?.()

  proc.on('exit', () => {
    clearTimeout(timer)
  })
}

/** SIGKILL inmediato al grupo (o taskkill /T /F en win32). Sin timer. */
export function killProcessTreeNow(proc: ChildProcess): void {
  if (!proc.pid || proc.exitCode !== null) return

  const pid = proc.pid

  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {
      /* swallow */
    })
    return
  }

  try {
    process.kill(-pid, 'SIGKILL')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
  }
}
