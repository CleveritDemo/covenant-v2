import { useCallback, useEffect, useRef, useState } from 'react'
import {
  insertIndexFromPointerY,
  moveItemToIndex,
  type PaneReorderKind,
} from '../arrayReorder'

export type PlaneReorderVisualState = 'idle' | 'jiggle' | 'dragging' | 'previewMoving'

const LONG_PRESS_MS = 400
const MOVE_CANCEL_PX = 8

export interface PlaneColumnSlot {
  x: number
  y: number
  width: number
  height: number
}

export interface UsePlaneColumnReorderOptions {
  enabled: boolean
  kind: PaneReorderKind
  orderedIds: readonly string[]
  slots: Record<string, PlaneColumnSlot>
  onCommit: (orderedIds: string[]) => void
  onActivate: (paneId: string) => void
  reducedMotion?: boolean
}

export interface UsePlaneColumnReorderResult {
  previewIds: string[] | null
  draggingId: string | null
  dragPosition: { x: number; y: number } | null
  editing: boolean
  getVisualState: (paneId: string) => PlaneReorderVisualState
  onCardPointerDown: (paneId: string, event: React.PointerEvent) => void
  cancel: () => void
}

interface PressSession {
  paneId: string
  pointerId: number
  startX: number
  startY: number
  grabOffsetX: number
  grabOffsetY: number
  longPressTimer: number
  longPressed: boolean
  dragging: boolean
}

export function usePlaneColumnReorder({
  enabled,
  kind: _kind,
  orderedIds,
  slots,
  onCommit,
  onActivate,
  reducedMotion = false,
}: UsePlaneColumnReorderOptions): UsePlaneColumnReorderResult {
  const [editing, setEditing] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [previewIds, setPreviewIds] = useState<string[] | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)

  const orderedIdsRef = useRef(orderedIds)
  const slotsRef = useRef(slots)
  const dragBaselineIdsRef = useRef<string[] | null>(null)
  const dragBaselineSlotsRef = useRef<Record<string, PlaneColumnSlot> | null>(null)
  const pressRef = useRef<PressSession | null>(null)
  const previewIdsRef = useRef<string[] | null>(null)
  const onCommitRef = useRef(onCommit)
  const onActivateRef = useRef(onActivate)

  orderedIdsRef.current = orderedIds
  slotsRef.current = slots
  previewIdsRef.current = previewIds
  onCommitRef.current = onCommit
  onActivateRef.current = onActivate

  const clearPressTimer = useCallback(() => {
    const press = pressRef.current
    if (!press) return
    window.clearTimeout(press.longPressTimer)
  }, [])

  const resetDragVisuals = useCallback(() => {
    setDraggingId(null)
    setPreviewIds(null)
    setDragPosition(null)
    previewIdsRef.current = null
    dragBaselineIdsRef.current = null
    dragBaselineSlotsRef.current = null
  }, [])

  const cancel = useCallback(() => {
    clearPressTimer()
    pressRef.current = null
    setEditing(false)
    resetDragVisuals()
  }, [clearPressTimer, resetDragVisuals])

  useEffect(() => {
    if (!enabled) cancel()
  }, [enabled, cancel])

  useEffect(() => {
    if (!editing && !draggingId) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, draggingId, cancel])

  const updatePreviewFromPointer = useCallback((paneId: string, pointerY: number) => {
    // Hit-test SIEMPRE contra baseline congelado (no contra el layout temporal).
    // Si se usan midpoints del preview, el orden al soltar puede volver al original.
    const baselineIds = dragBaselineIdsRef.current ?? [...orderedIdsRef.current]
    const baselineSlots = dragBaselineSlotsRef.current ?? slotsRef.current
    const fromIndex = baselineIds.indexOf(paneId)
    if (fromIndex < 0) return
    const insertAt = insertIndexFromPointerY(baselineIds, baselineSlots, pointerY, paneId)
    const next = moveItemToIndex(baselineIds, fromIndex, insertAt)
    previewIdsRef.current = next
    setPreviewIds(prev => {
      if (prev && prev.length === next.length && prev.every((id, i) => id === next[i])) {
        return prev
      }
      return next
    })
  }, [])
  const beginDrag = useCallback((press: PressSession, clientX: number, clientY: number) => {
    press.dragging = true
    press.longPressed = true
    // Congela orden/slots del gesto: un ResizeObserver no debe mover los midpoints.
    if (!dragBaselineIdsRef.current) {
      dragBaselineIdsRef.current = [...orderedIdsRef.current]
      dragBaselineSlotsRef.current = { ...slotsRef.current }
    }
    setEditing(true)
    setDraggingId(press.paneId)
    setDragPosition({
      x: press.grabOffsetX + (clientX - press.startX),
      y: press.grabOffsetY + (clientY - press.startY),
    })
    const cardH = (dragBaselineSlotsRef.current ?? slotsRef.current)[press.paneId]?.height ?? 0
    updatePreviewFromPointer(
      press.paneId,
      press.grabOffsetY + (clientY - press.startY) + cardH / 2,
    )
  }, [updatePreviewFromPointer])

  const onCardPointerDown = useCallback((paneId: string, event: React.PointerEvent) => {
    if (!enabled || event.button !== 0) return
    if (orderedIdsRef.current.length < 2) {
      onActivateRef.current(paneId)
      return
    }
    if ((event.target as HTMLElement | null)?.closest?.(
      'button, a, input, select, textarea, [role="button"], .plane-agent-context-nodes',
    )) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture?.(event.pointerId)

    const slot = slotsRef.current[paneId]
    const startSlotX = slot?.x ?? 0
    const startSlotY = slot?.y ?? 0

    clearPressTimer()
    const session: PressSession = {
      paneId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX: startSlotX,
      grabOffsetY: startSlotY,
      longPressed: editing,
      dragging: false,
      longPressTimer: window.setTimeout(() => {
        const press = pressRef.current
        if (!press || press.paneId !== paneId) return
        press.longPressed = true
        setEditing(true)
        beginDrag(press, press.startX, press.startY)
      }, LONG_PRESS_MS),
    }
    pressRef.current = session

    // Ya en modo edición: el pointerdown arrastra de inmediato.
    if (editing) {
      window.clearTimeout(session.longPressTimer)
      beginDrag(session, event.clientX, event.clientY)
    }

    const onMove = (moveEvent: PointerEvent): void => {
      const press = pressRef.current
      if (!press || press.paneId !== paneId || moveEvent.pointerId !== press.pointerId) return
      const dx = moveEvent.clientX - press.startX
      const dy = moveEvent.clientY - press.startY
      if (!press.longPressed && !press.dragging) {
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          window.clearTimeout(press.longPressTimer)
          pressRef.current = null
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
        }
        return
      }
      if (!press.dragging) {
        beginDrag(press, moveEvent.clientX, moveEvent.clientY)
      }
      const localX = press.grabOffsetX + (moveEvent.clientX - press.startX)
      const localY = press.grabOffsetY + (moveEvent.clientY - press.startY)
      setDragPosition({ x: localX, y: localY })
      const cardH = (dragBaselineSlotsRef.current ?? slotsRef.current)[press.paneId]?.height ?? 0
      updatePreviewFromPointer(press.paneId, localY + cardH / 2)
    }

    const onUp = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== event.pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)

      const press = pressRef.current
      pressRef.current = null
      if (!press || press.paneId !== paneId) return
      window.clearTimeout(press.longPressTimer)

      if (press.dragging) {
        const next = previewIdsRef.current
        const baseline = dragBaselineIdsRef.current ?? [...orderedIdsRef.current]
        const changed = Boolean(
          next
          && next.length === baseline.length
          && next.some((id, i) => id !== baseline[i]),
        )
        resetDragVisuals()
        setEditing(false)
        if (changed && next) onCommitRef.current(next)
        return
      }

      if (!press.longPressed) {
        onActivateRef.current(paneId)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [
    beginDrag,
    clearPressTimer,
    editing,
    enabled,
    resetDragVisuals,
    updatePreviewFromPointer,
  ])

  const getVisualState = useCallback((paneId: string): PlaneReorderVisualState => {
    if (draggingId === paneId) return 'dragging'
    // Mientras hay drag: las demás vibran (no solo al soltar en modo edición).
    if (draggingId && !reducedMotion) return 'jiggle'
    if (editing && !reducedMotion) return 'jiggle'
    return 'idle'
  }, [draggingId, editing, reducedMotion])

  return {
    previewIds,
    draggingId,
    dragPosition,
    editing,
    getVisualState,
    onCardPointerDown,
    cancel,
  }
}
