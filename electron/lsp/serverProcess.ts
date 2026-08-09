import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { encodeFrame, FrameDecoder } from './framing'

/** Últimos bytes de stderr que guardamos por server, para diagnosticar arranques fallidos. */
const STDERR_TAIL_BYTES = 4096

export interface LspServerHandle {
  send(message: string): void
  kill(): void
  /** Cola de stderr del proceso; útil cuando `initialize` nunca contesta. */
  stderrTail(): string
}

export interface SpawnLspOptions {
  bin: string
  args: string[]
  cwd: string
  onMessage: (message: string) => void
  /** Se dispara una vez, cuando stdout cierra (proceso muerto). */
  onExit: (code: number | null) => void
}

export function spawnLspServer(opts: SpawnLspOptions): LspServerHandle {
  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(opts.bin, opts.args, {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`server spawn failed: ${opts.bin}: ${detail}`)
  }

  const decoder = new FrameDecoder()
  let exited = false
  const fireExit = (code: number | null): void => {
    if (exited) return
    exited = true
    opts.onExit(code)
  }

  child.stdout.on('data', (chunk: Buffer) => {
    for (const msg of decoder.push(chunk)) opts.onMessage(msg)
  })
  child.stdout.on('end', () => fireExit(null))
  child.on('error', () => fireExit(null))
  child.on('close', code => fireExit(code))

  // stderr hay que drenarlo sí o sí: si el pipe se llena el hijo se bloquea.
  let stderrTail = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-STDERR_TAIL_BYTES)
  })

  child.stdin.on('error', () => {
    /* el server ya se fue; los envíos pendientes se descartan */
  })

  return {
    send(message: string): void {
      if (exited || child.stdin.destroyed) return
      child.stdin.write(encodeFrame(message))
    },
    kill(): void {
      try {
        child.kill('SIGTERM')
      } catch {
        /* ya estaba muerto */
      }
    },
    stderrTail: () => stderrTail,
  }
}
