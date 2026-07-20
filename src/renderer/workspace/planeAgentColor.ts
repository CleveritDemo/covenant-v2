/** Paleta de acentos por agente en el plano (estable por paneId). */
const PLANE_AGENT_COLORS = [
  '#5b8def',
  '#a78bfa',
  '#2dd4bf',
  '#f59e0b',
  '#f472b6',
  '#34d399',
  '#fb7185',
  '#38bdf8',
  '#c084fc',
  '#fbbf24',
] as const

/** Color fijo derivado del id del agente (no cambia entre sesiones). */
export function planeAgentColor(paneId: string): string {
  let hash = 2166136261
  for (let i = 0; i < paneId.length; i += 1) {
    hash ^= paneId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return PLANE_AGENT_COLORS[(hash >>> 0) % PLANE_AGENT_COLORS.length]
}
