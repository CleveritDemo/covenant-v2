import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildContextAssignmentEdges,
  buildContextConnectorPaths,
  contextConnectorAnchors,
  focusedContextEdges,
  renderedContextLinksEqual,
  type ContextAssignmentEdge,
  type ContextLinkFocus,
  type MeasuredContextLink,
  type RenderedContextLink,
} from './planeContextAssignmentLinkGeometry'
import './PlaneContextAssignmentLinks.css'

export type { ContextAssignmentEdge } from './planeContextAssignmentLinkGeometry'
export { buildContextAssignmentEdges } from './planeContextAssignmentLinkGeometry'

export interface PlaneContextAssignmentLinksProps {
  planeRef: React.RefObject<HTMLElement | null>
  agents: readonly { paneId: string; contextIds?: readonly string[] }[]
  colorByContextId: Readonly<Record<string, string>>
  hidden?: boolean
  /** Sobre el overlay de la sala (z 670), bajo el pool elevado (675). */
  elevated?: boolean
}

const POOL_CHIP_SELECTOR = '[data-context-pool-chip]'
/*
 * La card se marca con un atributo propio, no con la clase de la ventana del
 * plano: los asientos de la sala son el mismo destino de un contexto —y el
 * mismo haz— sin ser `pane-window`.
 */
const AGENT_CARD_SELECTOR = '[data-context-link-card]'
const NO_FOCUS: ContextLinkFocus = { contextId: null, paneId: null }

function focusFromEventTarget(target: EventTarget | null): ContextLinkFocus {
  if (!(target instanceof Element)) return NO_FOCUS

  const chip = target.closest(POOL_CHIP_SELECTOR)
  if (chip instanceof HTMLElement) {
    return { contextId: chip.dataset.contextPoolChip ?? null, paneId: null }
  }

  const card = target.closest(AGENT_CARD_SELECTOR)
  if (card instanceof HTMLElement) {
    return { contextId: null, paneId: card.dataset.contextLinkCard ?? null }
  }

  return NO_FOCUS
}

function sameFocus(a: ContextLinkFocus, b: ContextLinkFocus): boolean {
  return (a.contextId ?? null) === (b.contextId ?? null)
    && (a.paneId ?? null) === (b.paneId ?? null)
}

function measureLinks(
  plane: HTMLElement,
  edges: readonly ContextAssignmentEdge[],
): RenderedContextLink[] {
  const planeRect = plane.getBoundingClientRect()
  const measured: MeasuredContextLink[] = []

  for (const edge of edges) {
    const chip = plane.querySelector(`[data-context-pool-chip="${edge.contextId}"]`)
    const card = plane.querySelector(`[data-context-link-card="${edge.paneId}"]`)
    if (!(chip instanceof HTMLElement) || !(card instanceof HTMLElement)) continue

    const chipRect = chip.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    if (chipRect.width <= 0 || chipRect.height <= 0) continue
    if (cardRect.width <= 0 || cardRect.height <= 0) continue

    const icon = card.querySelector(`[data-agent-context-chip="${edge.contextId}"]`)
    const iconRect = icon instanceof HTMLElement ? icon.getBoundingClientRect() : null

    const { from, to } = contextConnectorAnchors(
      planeRect,
      chipRect,
      cardRect,
      iconRect && iconRect.height > 0 ? iconRect : null,
    )

    measured.push({ key: `${edge.contextId}:${edge.paneId}`, from, to, color: edge.color })
  }

  return buildContextConnectorPaths(measured)
}

/**
 * Conectores entre el pool de contextos y las minis de agente. Se dibujan solo para
 * lo señalado (un chip del pool o una card), para que informen sin llenar el plano.
 */
export const PlaneContextAssignmentLinks: React.FC<PlaneContextAssignmentLinksProps> = ({
  planeRef,
  agents,
  colorByContextId,
  hidden = false,
  elevated = false,
}) => {
  const edges = useMemo(
    () => buildContextAssignmentEdges(agents, colorByContextId),
    [agents, colorByContextId],
  )
  const edgeKey = useMemo(
    () => edges.map(edge => `${edge.contextId}:${edge.paneId}:${edge.color}`).join('|'),
    [edges],
  )
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const [shownFocus, setShownFocus] = useState<ContextLinkFocus>(NO_FOCUS)
  const [links, setLinks] = useState<RenderedContextLink[]>([])
  const measureRafRef = useRef(0)

  useEffect(() => {
    const plane = planeRef.current
    if (hidden || !plane) {
      setShownFocus(NO_FOCUS)
      return
    }

    const showNow = (next: ContextLinkFocus): void => {
      setShownFocus(prev => (sameFocus(prev, next) ? prev : next))
    }

    const onPointerOver = (ev: PointerEvent): void => {
      showNow(focusFromEventTarget(ev.target))
    }
    const onFocusIn = (ev: FocusEvent): void => {
      const next = focusFromEventTarget(ev.target)
      if (next.contextId || next.paneId) showNow(next)
    }
    const onLeave = (): void => showNow(NO_FOCUS)

    plane.addEventListener('pointerover', onPointerOver)
    plane.addEventListener('pointerleave', onLeave)
    plane.addEventListener('focusin', onFocusIn)

    return () => {
      plane.removeEventListener('pointerover', onPointerOver)
      plane.removeEventListener('pointerleave', onLeave)
      plane.removeEventListener('focusin', onFocusIn)
    }
  }, [planeRef, hidden])

  const focusKey = `${shownFocus.contextId ?? ''}>${shownFocus.paneId ?? ''}`

  useLayoutEffect(() => {
    const plane = planeRef.current
    const visible = focusedContextEdges(edgesRef.current, shownFocus)
    if (hidden || !plane || visible.length === 0) {
      setLinks([])
      return
    }

    const commit = (): void => {
      const next = measureLinks(plane, focusedContextEdges(edgesRef.current, shownFocus))
      setLinks(prev => (renderedContextLinksEqual(prev, next) ? prev : next))
    }

    const schedule = (): void => {
      if (measureRafRef.current) return
      measureRafRef.current = requestAnimationFrame(() => {
        measureRafRef.current = 0
        commit()
      })
    }

    commit()
    const observer = new ResizeObserver(schedule)
    observer.observe(plane)

    const poolIcons = plane.querySelector('.plane-context-pool__icons')
    if (poolIcons instanceof HTMLElement) observer.observe(poolIcons)

    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      if (measureRafRef.current) {
        cancelAnimationFrame(measureRafRef.current)
        measureRafRef.current = 0
      }
      observer.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
    // focusKey y edgeKey resumen focus/edges sin re-suscribir en cada render.
  }, [planeRef, hidden, focusKey, edgeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden || links.length === 0) return null

  return (
    <svg
      className={`plane-context-assignment-links${
        elevated ? ' plane-context-assignment-links--elevated' : ''
      }`}
      aria-hidden
      focusable="false"
    >
      {links.map(link => (
        <g key={link.key} className="plane-context-assignment-links__link">
          <path
            className="plane-context-assignment-links__path plane-context-assignment-links__path--halo"
            d={link.d}
            pathLength={1}
            stroke={link.color}
          />
          <path
            className="plane-context-assignment-links__path"
            d={link.d}
            pathLength={1}
            stroke={link.color}
          />
          <circle
            className="plane-context-assignment-links__node"
            cx={link.to.x}
            cy={link.to.y}
            r={2.5}
            fill={link.color}
          />
        </g>
      ))}
    </svg>
  )
}
