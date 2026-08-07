// Discord Rich Presence — compone la línea de estado desde estado grueso de la
// app y la publica vía el cliente IPC local del main. Frontera de privacidad:
// nombre de workspace + nº de sesiones + flag de agente; nunca comandos, cwds,
// rutas, títulos de pestaña ni salida.

export interface PresenceSnapshot {
  /** Nombre del workspace/proyecto activo (basename), o null. */
  workspace: string | null
  /** Nº de pestañas abiertas. */
  tabs: number
  /** Algún panel de agente está trabajando. */
  agentLive: boolean
}

export function composePresence(s: PresenceSnapshot): { details: string; state: string } {
  const details = s.workspace ? `In ${s.workspace}` : 'In Covenant Gravity'
  const sessions = `${s.tabs} session${s.tabs === 1 ? '' : 's'}`
  return {
    details,
    state: s.agentLive ? `${sessions} · agent running` : sessions,
  }
}

// ponytail: poll de 15s en vez de plomería de eventos — Discord limita las
// actualizaciones de actividad a una cada 15s de todos modos, y el diff-check
// hace que los ticks en reposo salgan gratis.
const TICK_MS = 15_000

let enabled = false
let timer: number | null = null
let lastSent: string | null = null
let startUnixSecs = 0
let snapshot: (() => PresenceSnapshot) | null = null

async function tick(): Promise<void> {
  if (!enabled || !snapshot) return
  const { details, state } = composePresence(snapshot())
  const line = `${details}\n${state}`
  if (line === lastSent) return
  try {
    const ok = await window.api.discordPresenceSet(details, state, startUnixSecs)
    // `false` = Discord no corriendo; no memorizamos para reintentar.
    lastSent = ok ? line : null
  } catch {
    lastSent = null
  }
}

/**
 * Cablea el bucle de presencia. Llamar una vez al arranque; después se
 * enciende/apaga con `setDiscordPresenceEnabled` (toggle de ajustes).
 */
export function startDiscordPresence(
  snapshotFn: () => PresenceSnapshot,
  initiallyEnabled: boolean,
): void {
  snapshot = snapshotFn
  startUnixSecs = Math.floor(Date.now() / 1000)
  setDiscordPresenceEnabled(initiallyEnabled)
}

export function setDiscordPresenceEnabled(on: boolean): void {
  enabled = on
  if (on) {
    if (timer === null) {
      timer = window.setInterval(() => void tick(), TICK_MS)
      void tick()
    }
    return
  }
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  if (lastSent !== null) {
    lastSent = null
    void window.api.discordPresenceClear().catch(() => {})
  }
}
