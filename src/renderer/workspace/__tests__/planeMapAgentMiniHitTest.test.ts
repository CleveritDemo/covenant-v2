/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  computePlaneMiniSlotCell,
  computePlaneMiniSlotPadX,
} from '@shared/paneWindows'
import { buildSlotOrigins, type PlaneMapEntity } from '../PlaneMap'
import { resolveAgentMiniPaneIdFromPointer } from '../planeMapAgentMiniHitTest'

const VIEWPORT = { width: 1280, height: 800 }

function makeAgent(paneId: string): PlaneMapEntity {
  return {
    paneId,
    kind: 'agent',
    title: paneId,
    busy: false,
    window: { open: false, fullscreen: false, zIndex: 1 },
  }
}

function mapRect(): DOMRect {
  return {
    left: 0,
    top: 0,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    right: VIEWPORT.width,
    bottom: VIEWPORT.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

function agentBandCenterX(terminalCount: number, agentCount: number): number {
  const columnCount = Math.max(terminalCount, agentCount, 1)
  const cell = computePlaneMiniSlotCell(VIEWPORT, columnCount)
  const padX = computePlaneMiniSlotPadX(VIEWPORT, columnCount)
  const agentX = Math.max(padX, VIEWPORT.width - padX - cell.width)
  return agentX + cell.width / 2
}

describe('resolveAgentMiniPaneIdFromPointer', () => {
  it('returns paneId when the point is inside an agent slot', () => {
    const agents = [makeAgent('a1'), makeAgent('a2')]
    const heights = { a1: 120, a2: 120 }
    const layout = buildSlotOrigins(agents, VIEWPORT, heights)
    const origin = layout.origins.a1
    const paneId = resolveAgentMiniPaneIdFromPointer({
      clientX: origin.x + origin.width / 2,
      clientY: origin.y + 60,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 0 },
      fadeProgressById: layout.fadeProgressById,
    })
    expect(paneId).toBe('a1')
  })

  it('returns null when the point is in the terminal band', () => {
    const agents = [makeAgent('a1')]
    const heights = { a1: 120 }
    const layout = buildSlotOrigins(agents, VIEWPORT, heights)
    const origin = layout.origins.a1
    const columnCount = 1
    const cell = computePlaneMiniSlotCell(VIEWPORT, columnCount)
    const padX = computePlaneMiniSlotPadX(VIEWPORT, columnCount)

    const paneId = resolveAgentMiniPaneIdFromPointer({
      clientX: padX + cell.width / 2,
      clientY: origin.y + 60,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      terminalCount: 2,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 0 },
      fadeProgressById: layout.fadeProgressById,
    })
    expect(paneId).toBeNull()
  })

  it('respects scroll offset when shifting agent Y', () => {
    const agents = Array.from({ length: 6 }, (_, index) => makeAgent(`a${index}`))
    const heights = Object.fromEntries(agents.map(agent => [agent.paneId, 130]))
    const base = buildSlotOrigins(agents, VIEWPORT, heights)
    const scrolled = buildSlotOrigins(agents, VIEWPORT, heights, { terminal: 0, agent: 80 })
    const origin = scrolled.origins.a3

    const hitBase = resolveAgentMiniPaneIdFromPointer({
      clientX: agentBandCenterX(0, agents.length),
      clientY: base.origins.a3.y + 65,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 0 },
      fadeProgressById: base.fadeProgressById,
    })
    const hitScrolled = resolveAgentMiniPaneIdFromPointer({
      clientX: agentBandCenterX(0, agents.length),
      clientY: origin.y + 65,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 80 },
      fadeProgressById: scrolled.fadeProgressById,
    })

    expect(hitBase).toBe('a3')
    expect(hitScrolled).toBe('a3')
    expect(scrolled.origins.a3.y).toBe(base.origins.a3.y - 80)
  })

  it('ignores agents with fadeProgress 0', () => {
    const agents = [makeAgent('a1'), makeAgent('a2')]
    const heights = { a1: 120, a2: 120 }
    const layout = buildSlotOrigins(agents, VIEWPORT, heights)
    const origin = layout.origins.a1

    const paneId = resolveAgentMiniPaneIdFromPointer({
      clientX: origin.x + origin.width / 2,
      clientY: origin.y + 60,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 0 },
      fadeProgressById: { a1: 0, a2: layout.fadeProgressById.a2 },
    })
    expect(paneId).not.toBe('a1')
  })

  it('prefers the agent with higher fade when rects overlap', () => {
    const agents = [makeAgent('a1'), makeAgent('a2')]
    const baseHeights = { a1: 120, a2: 120 }
    const layout = buildSlotOrigins(agents, VIEWPORT, baseHeights)
    const centerX = agentBandCenterX(0, agents.length)
    const a2CenterY = layout.origins.a2.y + baseHeights.a2 / 2
    const heights = {
      a1: a2CenterY - layout.origins.a1.y + 20,
      a2: baseHeights.a2,
    }

    const paneId = resolveAgentMiniPaneIdFromPointer({
      clientX: centerX,
      clientY: a2CenterY,
      mapRect: mapRect(),
      viewport: VIEWPORT,
      agentsInOrder: agents,
      agentHeights: heights,
      scrollOffsets: { terminal: 0, agent: 0 },
      fadeProgressById: { ...layout.fadeProgressById, a1: 0.7, a2: 0.9 },
    })

    expect(paneId).toBe('a2')
  })
})
