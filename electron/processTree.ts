import { execFile, execFileSync, type ChildProcess } from 'child_process'

export interface ProcRow {
  pid: number
  ppid: number
  pgid: number
}

/**
 * Snapshot síncrono de pid/ppid/pgid (posix). En error o win32 → [].
 * Debe ser sync: will-quit no tiene ventana async.
 */
export function snapshotProcs(): ProcRow[] {
  if (process.platform === 'win32') return []
  try {
    const out = execFileSync('ps', ['-Ao', 'pid=,ppid=,pgid='], {
      encoding: 'utf8',
      timeout: 2000,
    })
    const rows: ProcRow[] = []
    for (const line of out.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parts = trimmed.split(/\s+/)
      if (parts.length < 3) continue
      const pid = Number(parts[0])
      const ppid = Number(parts[1])
      const pgid = Number(parts[2])
      if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(pgid)) continue
      rows.push({ pid, ppid, pgid })
    }
    return rows
  } catch {
    return []
  }
}

/**
 * BFS por ppid desde rootPid. Devuelve descendientes SIN rootPid,
 * en orden de profundidad (más profundos al final). Protege ciclos; omite 0/1.
 */
export function collectDescendantPids(
  rootPid: number,
  procs: readonly ProcRow[],
): number[] {
  const childrenByPpid = new Map<number, number[]>()
  for (const row of procs) {
    const list = childrenByPpid.get(row.ppid)
    if (list) list.push(row.pid)
    else childrenByPpid.set(row.ppid, [row.pid])
  }

  const result: number[] = []
  const visited = new Set<number>([rootPid])
  const queue: number[] = [rootPid]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const childPid of childrenByPpid.get(current) ?? []) {
      if (visited.has(childPid)) continue
      if (childPid === 0 || childPid === 1) continue
      visited.add(childPid)
      result.push(childPid)
      queue.push(childPid)
    }
  }
  return result
}

function signalPid(row: ProcRow, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    if (row.pgid === row.pid) {
      process.kill(-row.pid, signal)
    } else {
      process.kill(row.pid, signal)
    }
  } catch {
    /* swallow */
  }
}

function findRow(procs: readonly ProcRow[], pid: number): ProcRow | undefined {
  return procs.find((r) => r.pid === pid)
}

function signalTree(
  proc: ChildProcess,
  signal: 'SIGTERM' | 'SIGKILL',
): { procs: ProcRow[]; allPids: number[] } | null {
  if (!proc.pid || proc.exitCode !== null) return null

  const pid = proc.pid
  const procs = snapshotProcs()
  const descendants = collectDescendantPids(pid, procs)

  // Deepest first — before the CLI dies and grandchildren reparent to 1
  for (let i = descendants.length - 1; i >= 0; i--) {
    const dPid = descendants[i]!
    const row = findRow(procs, dPid)
    if (row) signalPid(row, signal)
    else {
      try {
        process.kill(dPid, signal)
      } catch {
        /* swallow */
      }
    }
  }

  const cliRow = findRow(procs, pid)
  if (cliRow) {
    signalPid(cliRow, signal)
  } else {
    try {
      proc.kill(signal)
    } catch {
      /* swallow */
    }
  }

  return { procs, allPids: [...descendants, pid] }
}

/**
 * Mata un proceso y su árbol de descendientes (ppid en posix, /T en win32).
 * En posix: snapshot → SIGTERM deepest-first → escalada a SIGKILL tras escalateAfterMs.
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

  const signaled = signalTree(proc, 'SIGTERM')
  if (!signaled) return

  const { procs, allPids } = signaled
  const escalateAfterMs = options?.escalateAfterMs ?? 3000
  const timer = setTimeout(() => {
    for (const targetPid of allPids) {
      try {
        process.kill(targetPid, 0)
      } catch {
        continue
      }
      const row = findRow(procs, targetPid)
      if (row) signalPid(row, 'SIGKILL')
      else {
        try {
          process.kill(targetPid, 'SIGKILL')
        } catch {
          /* swallow */
        }
      }
    }
  }, escalateAfterMs)
  timer.unref?.()

  proc.on('exit', () => {
    clearTimeout(timer)
  })
}

/** SIGKILL inmediato al árbol (o taskkill /T /F en win32). Sin timer. */
export function killProcessTreeNow(proc: ChildProcess): void {
  if (!proc.pid || proc.exitCode !== null) return

  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => {
      /* swallow */
    })
    return
  }

  signalTree(proc, 'SIGKILL')
}
