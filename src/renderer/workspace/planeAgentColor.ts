/** Paleta de acentos por agente en el plano (estable y elegible en config). */
export const PLANE_AGENT_COLORS = [
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

export type PlaneAgentColor = (typeof PLANE_AGENT_COLORS)[number]

const COLOR_SET = new Set<string>(PLANE_AGENT_COLORS.map(color => color.toLowerCase()))

export function normalizeAgentColor(value: unknown): PlaneAgentColor | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(color)) return undefined
  return COLOR_SET.has(color) ? color as PlaneAgentColor : undefined
}

/** Color fijo derivado del id del agente (fallback si no hay color guardado). */
export function planeAgentColor(paneId: string): string {
  let hash = 2166136261
  for (let i = 0; i < paneId.length; i += 1) {
    hash ^= paneId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return PLANE_AGENT_COLORS[(hash >>> 0) % PLANE_AGENT_COLORS.length]
}

/** Color efectivo: configuración persistida o hash del paneId. */
export function resolveAgentColor(paneId: string, color?: string | null): string {
  return normalizeAgentColor(color) ?? planeAgentColor(paneId)
}
