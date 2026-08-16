import {
  computePlaneMiniColumnLayout,
  PLANE_MINI_AGENT_WIDTH,
} from '@shared/paneWindows'
import { buildSlotOrigins, type PlaneColumnScrollOffsets, type PlaneMapEntity } from './PlaneMap'

export interface AgentMiniHitTestInput {
  clientX: number
  clientY: number
  mapRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
  viewport: { width: number; height: number }
  agentsInOrder: ReadonlyArray<PlaneMapEntity>
  /** Terminales en columna (ancho de celda); default 0. */
  terminalCount?: number
  agentHeights: Record<string, number>
  scrollOffsets: PlaneColumnScrollOffsets
  fadeProgressById: Record<string, number>
}

interface FlatRect {
  x: number
  y: number
  width: number
  height: number
}

/** Minis visibles a escala 1; la implosión es animación puntual, no ligada al scroll. */
export function miniBandEnterScale(_fadeProgress: number): number {
  return 1
}

function applyCenterScale(rect: FlatRect, scale: number): FlatRect {
  if (scale === 1) return rect
  const scaledWidth = rect.width * scale
  const scaledHeight = rect.height * scale
  return {
    x: rect.x + (rect.width - scaledWidth) / 2,
    y: rect.y + (rect.height - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  }
}

function pointInRect(px: number, py: number, rect: FlatRect): boolean {
  return px >= rect.x
    && px <= rect.x + rect.width
    && py >= rect.y
    && py <= rect.y + rect.height
}

/**
 * Hit-test plano para minis de agente.
 * Devuelve paneId o null si el punto cae fuera de la banda agente.
 */
export function resolveAgentMiniPaneIdFromPointer(
  input: AgentMiniHitTestInput,
): string | null {
  const {
    clientX,
    clientY,
    mapRect,
    viewport,
    agentsInOrder,
    terminalCount = 0,
    agentHeights,
    scrollOffsets,
    fadeProgressById,
  } = input

  if (mapRect.width <= 0 || mapRect.height <= 0) return null
  if (agentsInOrder.length === 0) return null

  const localX = clientX - mapRect.left
  const localY = clientY - mapRect.top
  if (
    localX < 0
    || localY < 0
    || localX > mapRect.width
    || localY > mapRect.height
  ) return null

  const vp = viewport.width > 0 ? viewport : { width: 960, height: 640 }
  const columnCount = Math.max(terminalCount, agentsInOrder.length, 1)
  const columnLayout = computePlaneMiniColumnLayout(vp, columnCount)
  const agentX = columnLayout.agentX
  const tolerance = Math.max(24, Math.round(PLANE_MINI_AGENT_WIDTH / 2))

  if (localX < agentX - tolerance || localX > agentX + PLANE_MINI_AGENT_WIDTH + tolerance) {
    return null
  }

  const layout = buildSlotOrigins(agentsInOrder, vp, agentHeights, scrollOffsets)

  let best: { paneId: string; fade: number; index: number } | null = null

  for (let index = 0; index < agentsInOrder.length; index += 1) {
    const agent = agentsInOrder[index]
    const fade = fadeProgressById[agent.paneId] ?? layout.fadeProgressById[agent.paneId] ?? 1
    if (fade <= 0) continue

    const origin = layout.origins[agent.paneId]
    if (!origin) continue

    const height = agentHeights[agent.paneId] ?? origin.height
    const rect = applyCenterScale({
      x: origin.x,
      y: origin.y,
      width: origin.width,
      height,
    }, miniBandEnterScale(fade))

    if (!pointInRect(localX, localY, rect)) continue

    if (
      !best
      || fade > best.fade
      || (fade === best.fade && index > best.index)
    ) {
      best = { paneId: agent.paneId, fade, index }
    }
  }

  return best?.paneId ?? null
}
