/**
 * Discord Rich Presence vía el socket IPC local de Discord.
 *
 * Sin bot, sin token, sin red: el mismo mecanismo que usa el plugin
 * "Discord Presence" de VS Code. El renderer compone la línea de estado
 * (workspace + nº de sesiones + agente activo) y llama a `setPresence`;
 * este módulo solo posee el socket.
 *
 * ponytail: framing a mano sobre `node:net` en vez de una dependencia npm —
 * el protocolo son 8 bytes de cabecera + JSON, y así evitamos otro binario
 * nativo con el dolor de ABI que ya arrastra node-pty.
 *
 * La conexión es lazy: conectamos en el primer `setPresence`, y si Discord no
 * está corriendo la llamada falla y el siguiente tick reintenta. Sin polling
 * ni bucle de reconexión propio.
 */

import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

/**
 * Application id de "Covenant" en discord.com/developers.
 * El logo vive allí como asset de Rich Presence con nombre `covenant`.
 */
const DISCORD_APP_ID = '1526388703260442756'

/** Discord abre `discord-ipc-0`..`discord-ipc-9`; probamos en orden. */
const MAX_SOCKET_INDEX = 10

/** Corte para el handshake: si Discord no responde, tratamos como caído. */
const HANDSHAKE_TIMEOUT_MS = 2_000

let sock: net.Socket | null = null

function socketPath(index: number): string {
  // macOS/Linux. En Windows sería `\\?\pipe\discord-ipc-N` (Gravity es macOS-only).
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || os.tmpdir()
  return path.join(base.replace(/\/+$/, ''), `discord-ipc-${index}`)
}

/** Un frame del IPC de Discord: opcode LE u32 + longitud LE u32 + JSON. */
function frame(op: number, payload: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(payload), 'utf8')
  const head = Buffer.alloc(8)
  head.writeUInt32LE(op, 0)
  head.writeUInt32LE(json.length, 4)
  return Buffer.concat([head, json])
}

/** Conecta al primer socket disponible y espera el frame READY del handshake. */
async function connect(): Promise<net.Socket> {
  for (let i = 0; i < MAX_SOCKET_INDEX; i += 1) {
    let candidate: net.Socket
    try {
      candidate = await new Promise<net.Socket>((resolve, reject) => {
        const c = net.createConnection(socketPath(i))
        c.once('connect', () => resolve(c))
        c.once('error', reject)
      })
    } catch {
      continue
    }
    try {
      // El handshake debe completarse antes de mandar actividades.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('handshake timeout')), HANDSHAKE_TIMEOUT_MS)
        candidate.once('data', () => {
          clearTimeout(timer)
          resolve()
        })
        candidate.once('error', err => {
          clearTimeout(timer)
          reject(err)
        })
        candidate.write(frame(0, { v: 1, client_id: DISCORD_APP_ID }))
      })
    } catch {
      candidate.destroy()
      continue
    }
    // Drena las respuestas que no leemos para no acumular backpressure.
    candidate.on('data', () => {})
    candidate.on('error', () => {
      sock = null
    })
    candidate.on('close', () => {
      sock = null
    })
    return candidate
  }
  throw new Error('Discord IPC no disponible')
}

/**
 * Publica una actividad. Lanza cuando Discord no está corriendo; el renderer
 * lo trata como "reintenta en el próximo tick".
 */
export async function setPresence(
  details: string,
  state: string,
  startUnixSecs: number,
): Promise<void> {
  if (!sock) sock = await connect()
  sock.write(
    frame(1, {
      cmd: 'SET_ACTIVITY',
      nonce: `${startUnixSecs}-${Date.now()}`,
      args: {
        pid: process.pid,
        activity: {
          details,
          state,
          timestamps: { start: startUnixSecs },
          assets: { large_image: 'covenant', large_text: 'Covenant Gravity' },
        },
      },
    }),
  )
}

/** Borra la actividad y cierra la conexión (toggle off / cierre de app). */
export function clearPresence(): void {
  if (!sock) return
  try {
    // `args` sin `activity` = limpiar.
    sock.write(frame(1, { cmd: 'SET_ACTIVITY', nonce: 'clear', args: { pid: process.pid } }))
  } catch {
    // Socket ya roto: da igual, lo destruimos igualmente.
  }
  sock.destroy()
  sock = null
}
