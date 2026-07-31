import { useCallback, useEffect, useRef, useState } from 'react'
import {
  insertIndexFromPointerY,
  moveItemToIndex,
  type PaneReorderKind,
} from '../arrayReorder'

export type PlaneReorderVisualState = 'idle' | 'jiggle' | 'dragging' | 'previewMoving'

const LONG_PRESS_MS = 400
/** Terminal: jitter beyond this cancels long-press arming (not the whole press). */
export const MOVE_CANCEL_PX = 8
/** Umbral para iniciar drag desde el handle (click corto = no-op). */
export const HANDLE_DRAG_THRESHOLD_PX = 6
const HANDLE_REENTRY_MS = 300

/** ¿Hay que persistir un nuevo orden al soltar? */
export function shouldCommitReorder(
  baseline: readonly string[] | null | undefined,
  preview: readonly string[] | null | undefined,
): preview is string[] {
  return Boolean(
    preview
    && baseline
    && preview.length === baseline.length
    && preview.some((id, i) => id !== baseline[i]),
  )
}

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
  /** true desde pointerdown del gesto hasta finish/cancel (antes del umbral de drag). */
  gestureActive: boolean
  getVisualState: (paneId: string) => PlaneReorderVisualState
  onCardPointerDown: (paneId: string, event: React.PointerEvent) => void
  /** Handle de agentes: sin long-press; drag al superar umbral de movimiento. */
  onHandlePointerDown: (paneId: string, event: React.PointerEvent) => void
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
  /** Terminal long-press: modo edición sticky. Handle dragOnMove: false. */
  persistEditing: boolean
  /** true = handle: drag al mover; false = terminal: long-press. */
  dragOnMove: boolean
  captureTarget: HTMLElement | null
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
  const [gestureActive, setGestureActive] = useState(false)

  const orderedIdsRef = useRef(orderedIds)
  const slotsRef = useRef(slots)
  const dragBaselineIdsRef = useRef<string[] | null>(null)
  const dragBaselineSlotsRef = useRef<Record<string, PlaneColumnSlot> | null>(null)
  const pressRef = useRef<PressSession | null>(null)
  const previewIdsRef = useRef<string[] | null>(null)
  const onCommitRef = useRef(onCommit)
  const onActivateRef = useRef(onActivate)
  const handleCooldownUntilRef = useRef(0)

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
    setGestureActive(false)
    setEditing(false)
    resetDragVisuals()
  }, [clearPressTimer, resetDragVisuals])

  useEffect(() => {
    if (!enabled) cancel()
  }, [enabled, cancel])

  useEffect(() => {
    if (!editing && !draggingId && !gestureActive) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, draggingId, gestureActive, cancel])

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

  const beginDrag = useCallback((
    press: PressSession,
    clientX: number,
    clientY: number,
    persistEditing = true,
  ) => {
    press.dragging = true
    press.longPressed = true
    // Congela orden/slots del gesto: un ResizeObserver no debe mover los midpoints.
    if (!dragBaselineIdsRef.current) {
      dragBaselineIdsRef.current = [...orderedIdsRef.current]
      dragBaselineSlotsRef.current = { ...slotsRef.current }
    }
    if (persistEditing) setEditing(true)
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

  const attachPointerSession = useCallback((
    paneId: string,
    event: React.PointerEvent,
    dragOnMove: boolean,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture?.(event.pointerId)

    const slot = slotsRef.current[paneId]
    const startSlotX = slot?.x ?? 0
    const startSlotY = slot?.y ?? 0
    const persistEditing = !dragOnMove

    clearPressTimer()
    setGestureActive(true)
    // Handle: congela baseline ya en pointerdown (antes del umbral / flatten mid-gesto).
    if (dragOnMove) {
      dragBaselineIdsRef.current = [...orderedIdsRef.current]
      dragBaselineSlotsRef.current = { ...slotsRef.current }
    }

    const session: PressSession = {
      paneId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX: startSlotX,
      grabOffsetY: startSlotY,
      // Handle: no drag hasta superar umbral. Terminal ya en editing: listo para arrastrar.
      longPressed: !dragOnMove && editing,
      dragging: false,
      persistEditing,
      dragOnMove,
      captureTarget: target,
      longPressTimer: dragOnMove
        ? 0
        : window.setTimeout(() => {
          const press = pressRef.current
          if (!press || press.paneId !== paneId) return
          press.longPressed = true
          beginDrag(press, press.startX, press.startY, press.persistEditing)
        }, LONG_PRESS_MS),
    }
    pressRef.current = session

    // Solo terminales en modo edición sticky: drag inmediato al pointerdown.
    // Handle (dragOnMove): esperar movimiento > umbral.
    if (!dragOnMove && editing) {
      if (session.longPressTimer) window.clearTimeout(session.longPressTimer)
      beginDrag(session, event.clientX, event.clientY, session.persistEditing)
    }

    const detachListeners = (captureEl: HTMLElement | null): void => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      target.removeEventListener('lostpointercapture', onLostCapture)
      document.body.removeEventListener('lostpointercapture', onLostCapture)
      if (captureEl && captureEl !== target && captureEl !== document.body) {
        captureEl.removeEventListener('lostpointercapture', onLostCapture)
      }
    }

    const onMove = (moveEvent: PointerEvent): void => {
      const press = pressRef.current
      if (!press || press.paneId !== paneId || moveEvent.pointerId !== press.pointerId) return
      const dx = moveEvent.clientX - press.startX
      const dy = moveEvent.clientY - press.startY
      const distance = Math.hypot(dx, dy)

      if (press.dragOnMove) {
        if (!press.dragging) {
          if (distance <= HANDLE_DRAG_THRESHOLD_PX) return
          beginDrag(press, moveEvent.clientX, moveEvent.clientY, press.persistEditing)
        }
      } else if (!press.longPressed && !press.dragging) {
        // Terminal: jitter cancela solo el armado del long-press; el press sigue
        // vivo para que pointerup llame onActivate (expandir mini).
        if (distance > MOVE_CANCEL_PX && press.longPressTimer) {
          window.clearTimeout(press.longPressTimer)
          press.longPressTimer = 0
        }
        return
      } else if (!press.dragging) {
        beginDrag(press, moveEvent.clientX, moveEvent.clientY, press.persistEditing)
      }

      if (!press.dragging) return
      const localX = press.grabOffsetX + (moveEvent.clientX - press.startX)
      const localY = press.grabOffsetY + (moveEvent.clientY - press.startY)
      setDragPosition({ x: localX, y: localY })
      const cardH = (dragBaselineSlotsRef.current ?? slotsRef.current)[press.paneId]?.height ?? 0
      updatePreviewFromPointer(press.paneId, localY + cardH / 2)
    }

    const finishGesture = (pointerId: number): void => {
      const press = pressRef.current
      // Idempotente: si ya se limpió (otro up/lostcapture), no re-commit.
      if (!press || press.paneId !== paneId || press.pointerId !== pointerId) return
      pressRef.current = null
      setGestureActive(false)
      detachListeners(press.captureTarget)
      window.clearTimeout(press.longPressTimer)
      try {
        press.captureTarget?.releasePointerCapture?.(press.pointerId)
      } catch { /* already released */ }

      if (press.dragging) {
        const next = previewIdsRef.current
        const baseline = dragBaselineIdsRef.current ?? [...orderedIdsRef.current]
        const changed = shouldCommitReorder(baseline, next)
        // Commit síncrono ANTES de limpiar preview → evita un frame con orden viejo.
        if (changed) onCommitRef.current(next)
        resetDragVisuals()
        setEditing(false)
        if (dragOnMove) {
          handleCooldownUntilRef.current = Date.now() + HANDLE_REENTRY_MS
        }
        return
      }

      // Handle click sin mover: solo cleanup (sin activate/commit).
      if (dragOnMove) {
        resetDragVisuals()
        return
      }

      setEditing(false)
      if (!press.longPressed) {
        onActivateRef.current(paneId)
      }
    }

    const onUp = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== event.pointerId) return
      finishGesture(upEvent.pointerId)
    }

    const onLostCapture = (lostEvent: PointerEvent): void => {
      if (lostEvent.pointerId !== event.pointerId) return
      const press = pressRef.current
      if (!press || press.paneId !== paneId || press.pointerId !== lostEvent.pointerId) return
      // Flatten/remount puede soltar capture a mitad del gesto: re-capturar si sigue pulsado.
      if (lostEvent.buttons !== 0) {
        try {
          press.captureTarget?.removeEventListener('lostpointercapture', onLostCapture)
          document.body.setPointerCapture?.(lostEvent.pointerId)
          press.captureTarget = document.body
          document.body.addEventListener('lostpointercapture', onLostCapture)
        } catch { /* ignore */ }
        return
      }
      finishGesture(lostEvent.pointerId)
    }

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    target.addEventListener('lostpointercapture', onLostCapture)
  }, [
    beginDrag,
    clearPressTimer,
    editing,
    resetDragVisuals,
    updatePreviewFromPointer,
  ])

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
    attachPointerSession(paneId, event, false)
  }, [attachPointerSession, enabled])

  const onHandlePointerDown = useCallback((paneId: string, event: React.PointerEvent) => {
    if (!enabled || event.button !== 0) return
    if (Date.now() < handleCooldownUntilRef.current) return
    if (orderedIdsRef.current.length < 2) {
      onActivateRef.current(paneId)
      return
    }
    attachPointerSession(paneId, event, true)
  }, [attachPointerSession, enabled])

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
    gestureActive,
    getVisualState,
    onCardPointerDown,
    onHandlePointerDown,
    cancel,
  }
}
