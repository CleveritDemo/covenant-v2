import { execFile, execFileSync, type ChildProcess } from 'child_process'

export interface ProcRow {
  pid: number
  ppid: number
  pgid: number
  start: string
}

/**
 * Snapshot síncrono de pid/ppid/pgid/lstart (posix). En error o win32 → [].
 * Debe ser sync: will-quit no tiene ventana async.
 */
export function snapshotProcs(): ProcRow[] {
  if (process.platform === 'win32') return []
  try {
    const out = execFileSync('ps', ['-Ao', 'pid=,ppid=,pgid=,lstart='], {
      encoding: 'utf8',
      timeout: 2000,
    })
    const rows: ProcRow[] = []
    for (const line of out.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parts = trimmed.split(/\s+/)
      if (parts.length < 4) continue
      const pid = Number(parts[0])
      const ppid = Number(parts[1])
      const pgid = Number(parts[2])
      const start = parts.slice(3).join(' ').trim()
      if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(pgid)) continue
      if (!start) continue
      rows.push({ pid, ppid, pgid, start })
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

/** Pids que nunca se señalan: 0, 1, process.pid y toda su cadena de ancestros. */
export function forbiddenPids(procs: readonly ProcRow[]): Set<number> {
  const forbidden = new Set<number>([0, 1, process.pid])
  const byPid = new Map<number, ProcRow>()
  for (const row of procs) {
    if (!byPid.has(row.pid)) byPid.set(row.pid, row)
  }

  let current = process.pid
  for (let i = 0; i < 64; i++) {
    const row = byPid.get(current)
    if (!row) break
    const ppid = row.ppid
    if (forbidden.has(ppid)) break
    forbidden.add(ppid)
    current = ppid
  }
  return forbidden
}

/** True si el ChildProcess ya terminó (código o señal). No usa proc.killed. */
export function hasExited(proc: ChildProcess): boolean {
  return proc.exitCode !== null || proc.signalCode !== null
}

function signalPid(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    process.kill(pid, signal)
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
): { targets: ProcRow[] } | null {
  if (!proc.pid || hasExited(proc)) return null

  const pid = proc.pid
  const procs = snapshotProcs()
  const forbidden = forbiddenPids(procs)

  if (forbidden.has(pid)) return { targets: [] }

  const descendants = collectDescendantPids(pid, procs)
  const targets: ProcRow[] = []

  // Deepest first — before the CLI dies and grandchildren reparent to 1
  for (let i = descendants.length - 1; i >= 0; i--) {
    const dPid = descendants[i]!
    if (forbidden.has(dPid)) continue
    const row = findRow(procs, dPid)
    if (!row) continue
    targets.push(row)
    signalPid(row.pid, signal)
  }

  const cliRow = findRow(procs, pid)
  if (cliRow) {
    if (!forbidden.has(pid)) {
      targets.push(cliRow)
      signalPid(cliRow.pid, signal)
    }
  } else if (!hasExited(proc)) {
    try {
      proc.kill(signal)
    } catch {
      /* swallow */
    }
  }

  return { targets }
}

/**
 * Mata un proceso y su árbol de descendientes (ppid en posix, /T en win32).
 * En posix: snapshot → SIGTERM deepest-first → escalada a SIGKILL tras escalateAfterMs.
 */
export function killProcessTree(
  proc: ChildProcess,
  options?: { escalateAfterMs?: number },
): void {
  if (!proc.pid || hasExited(proc)) return

  const pid = proc.pid

  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {
      /* swallow */
    })
    return
  }

  const signaled = signalTree(proc, 'SIGTERM')
  if (!signaled) return

  const { targets } = signaled
  const escalateAfterMs = options?.escalateAfterMs ?? 3000
  const timer = setTimeout(() => {
    const fresh = snapshotProcs()
    const forbidden = forbiddenPids(fresh)
    for (const target of targets) {
      if (forbidden.has(target.pid)) continue
      const row = findRow(fresh, target.pid)
      if (!row || row.start !== target.start) continue
      signalPid(row.pid, 'SIGKILL')
    }
  }, escalateAfterMs)
  timer.unref?.()

  proc.on('exit', () => {
    clearTimeout(timer)
  })
}

/** SIGKILL inmediato al árbol (o taskkill /T /F en win32). Sin timer. */
export function killProcessTreeNow(proc: ChildProcess): void {
  if (!proc.pid || hasExited(proc)) return

  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => {
      /* swallow */
    })
    return
  }

  signalTree(proc, 'SIGKILL')
}
