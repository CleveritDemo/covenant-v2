import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { setPlaneContextDragData } from './planeContextDrag'
import { PlaneContextAssignModal } from './PlaneContextAssignModal'
import { PlaneContextChipMenu } from './PlaneContextChipMenu'
import type { PlaneContextChipMenuItem } from './PlaneContextChipMenu'
import {
  assignedPaneIdsByContext,
  splitPoolContexts,
  type PlaneContextPoolAgent,
  type PlaneContextPoolItem,
} from './planeContextPoolLayout'
import './PlaneContextPool.css'

export type { PlaneContextPoolAgent, PlaneContextPoolItem } from './planeContextPoolLayout'

/**
 * Chromium rasteriza el fantasma del arrastre sobre un fondo opaco cuando el
 * chip cuelga de la barra glass del pool: salen esquinas rectas blancas. Se
 * arrastra un clon colgado del `body`, fuera de ese contexto, para que respete
 * el radio y la transparencia.
 */
function setChipDragImage(event: React.DragEvent<HTMLButtonElement>): void {
  const ghost = event.currentTarget.cloneNode(true) as HTMLElement
  // Fuera de la barra no hay `--expanded` que reabra el chip de overflow:
  // se quedaría en width:0 / opacity:0 y el arrastre no mostraría nada.
  ghost.classList.remove('plane-context-pool__chip--overflow')
  ghost.classList.add('plane-context-pool__chip--ghost')
  document.body.appendChild(ghost)
  const { width, height } = ghost.getBoundingClientRect()
  event.dataTransfer.setDragImage(ghost, width / 2, height / 2)
  window.setTimeout(() => ghost.remove(), 0)
}

export interface PlaneContextPoolProps {
  title: string
  configureLabel: string
  createLabel: string
  /** Hint del chip (segunda línea del tooltip + aria): clic menú, arrastrar a agente. */
  chipActionHint?: string
  /** Título del modal de asignación. */
  assignLabel: string
  /** Texto cuando el plano no tiene agentes. */
  assignEmptyHint: string
  /** Aria del contador del chip, ya interpolado. */
  assignedCountLabel: (count: number) => string
  editLabel: string
  deleteLabel: string
  deleteConfirmMessage: (name: string) => string
  deleteConfirmDetail: string
  contexts: PlaneContextPoolItem[]
  /** Catálogo completo para el preview del modal. */
  contextCatalog?: TabContext[]
  /** Carpeta del proyecto (preview IPC). */
  cwd?: string
  /** Agentes del plano (orden de la columna). */
  agents: PlaneContextPoolAgent[]
  onConfigure: () => void
  /** Abre el modal de contextos directo en el formulario de creación. */
  onCreate: () => void
  /** Abre ese contexto para editarlo. */
  onOpenContext?: (contextId: string) => void
  /** Elimina el contexto (tras ConfirmTerminalModal en el menú del chip). */
  onDeleteContext?: (contextId: string) => void
  /** Asigna/desasigna un contexto a un agente. */
  onToggleAssign: (paneId: string, contextId: string) => void
}

/** Breve gracia al salir del puntero (cruces rápidos entre chips). */
const COLLAPSE_GRACE_MS = 80

export const PlaneContextPool: React.FC<PlaneContextPoolProps> = ({
  title,
  configureLabel,
  createLabel,
  chipActionHint,
  assignLabel,
  assignEmptyHint,
  assignedCountLabel,
  editLabel,
  deleteLabel,
  deleteConfirmMessage,
  deleteConfirmDetail,
  contexts,
  contextCatalog = [],
  cwd = '',
  agents,
  onConfigure,
  onCreate,
  onOpenContext,
  onDeleteContext,
  onToggleAssign,
}) => {
  const { t } = useT()
  const dragOccurredRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const pointerInsideRef = useRef(false)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [keyboardExpanded, setKeyboardExpanded] = useState(false)
  const [draggingChip, setDraggingChip] = useState(false)
  const [rovingIndex, setRovingIndex] = useState(0)
  const [chipMenu, setChipMenu] = useState<{ contextId: string; anchor: DOMRect } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const visibleContexts = useMemo(
    () => contexts.filter(isProjectContext),
    [contexts],
  )
  const assignedByContext = useMemo(
    () => assignedPaneIdsByContext(agents),
    [agents],
  )
  const assignedCount = useCallback(
    (contextId: string) => (assignedByContext[contextId] ?? []).length,
    [assignedByContext],
  )
  const { visible: barContexts, overflow: overflowContexts } = useMemo(
    () => splitPoolContexts(visibleContexts, assignedCount),
    [visibleContexts, assignedCount],
  )

  const openContext = openContextId
    ? visibleContexts.find(ctx => ctx.id === openContextId) ?? null
    : null
  const previewContext = openContextId
    ? contextCatalog.find(ctx => ctx.id === openContextId) ?? null
    : null
  const chipMenuContext = chipMenu
    ? visibleContexts.find(ctx => ctx.id === chipMenu.contextId) ?? null
    : null

  useEffect(() => {
    if (openContextId && !openContext) setOpenContextId(null)
  }, [openContextId, openContext])

  const expansionPinned = draggingChip
  const expanded = hoverExpanded || keyboardExpanded || expansionPinned

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }, [])

  const releaseShellFocus = useCallback(() => {
    const root = rootRef.current
    const active = document.activeElement
    if (root && active instanceof HTMLElement && root.contains(active)) {
      active.blur()
    }
  }, [])

  const commitCollapse = useCallback(() => {
    clearCollapseTimer()
    if (expansionPinned || pointerInsideRef.current) return
    setHoverExpanded(false)
    setKeyboardExpanded(false)
    releaseShellFocus()
  }, [clearCollapseTimer, expansionPinned, releaseShellFocus])

  const scheduleCollapse = useCallback(() => {
    if (expansionPinned || pointerInsideRef.current) return
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null
      commitCollapse()
    }, COLLAPSE_GRACE_MS)
  }, [clearCollapseTimer, commitCollapse, expansionPinned])

  useEffect(() => () => {
    clearCollapseTimer()
  }, [clearCollapseTimer])

  useEffect(() => {
    if (expansionPinned) return
    if (!pointerInsideRef.current) scheduleCollapse()
  }, [expansionPinned, scheduleCollapse])

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.plane-context-chip-menu')) return
      pointerInsideRef.current = false
      clearCollapseTimer()
      setHoverExpanded(false)
      setKeyboardExpanded(false)
      releaseShellFocus()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [expanded, clearCollapseTimer, releaseShellFocus])

  const onPoolPointerEnter = useCallback(() => {
    pointerInsideRef.current = true
    clearCollapseTimer()
    setHoverExpanded(true)
  }, [clearCollapseTimer])

  const onPoolPointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const related = event.relatedTarget
    if (related instanceof Node && rootRef.current?.contains(related)) return
    pointerInsideRef.current = false
    scheduleCollapse()
  }, [scheduleCollapse])

  const onPoolFocusIn = useCallback(() => {
    clearCollapseTimer()
    setKeyboardExpanded(true)
  }, [clearCollapseTimer])

  const onPoolFocusOut = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const related = event.relatedTarget
    if (related instanceof Node && rootRef.current?.contains(related)) return
    setKeyboardExpanded(false)
    if (!pointerInsideRef.current && !expansionPinned) {
      scheduleCollapse()
    }
  }, [expansionPinned, scheduleCollapse])

  /** Roving tabindex: la barra entera es una sola parada de tabulación. */
  const onToolbarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pool-item]'))
    const from = items.indexOf(document.activeElement as HTMLElement)
    if (from < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = (from + step + items.length) % items.length
    setRovingIndex(next)
    items[next].focus()
  }, [])

  const itemProps = (index: number) => ({
    'data-pool-item': true,
    tabIndex: index === rovingIndex ? 0 : -1,
    onFocus: () => setRovingIndex(index),
  })

  const contextItemProps = (ctx: PlaneContextPoolItem) => ({
    draggable: true,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (dragOccurredRef.current) {
        dragOccurredRef.current = false
        return
      }
      setChipMenu(null)
      if (openContextId === ctx.id) {
        setOpenContextId(null)
        return
      }
      setOpenContextId(ctx.id)
    },
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (dragOccurredRef.current) return
      setOpenContextId(null)
      setChipMenu({
        contextId: ctx.id,
        anchor: event.currentTarget.getBoundingClientRect(),
      })
    },
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
    },
    onDragStart: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      dragOccurredRef.current = true
      setDraggingChip(true)
      setOpenContextId(null)
      setChipMenu(null)
      setPlaneContextDragData(event.dataTransfer, ctx.id)
      setChipDragImage(event)
    },
    onDragEnd: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      setDraggingChip(false)
      endChipDrag()
      if (!pointerInsideRef.current) scheduleCollapse()
    },
  })

  const contextSummary = (ctx: PlaneContextPoolItem): string => {
    const count = assignedCount(ctx.id)
    return [
      `${ctx.name} — ${ctx.kindLabel}`,
      count > 0 ? assignedCountLabel(count) : '',
    ].filter(Boolean).join(' · ')
  }

  const closeAssignModal = useCallback(() => setOpenContextId(null), [])

  const endChipDrag = useCallback(() => {
    window.setTimeout(() => {
      dragOccurredRef.current = false
    }, 50)
  }, [])

  const requestDelete = useCallback((contextId: string, name: string) => {
    if (!onDeleteContext) return
    setPendingDelete({ id: contextId, name })
  }, [onDeleteContext])

  const chipMenuItems = useMemo((): PlaneContextChipMenuItem[] => {
    if (!chipMenu || !chipMenuContext) return []
    const id = chipMenu.contextId
    const name = chipMenuContext.name
    const items: PlaneContextChipMenuItem[] = []
    if (onOpenContext) {
      items.push({
        key: 'edit',
        label: editLabel,
        icon: 'pencil' as const,
        onSelect: () => onOpenContext(id),
      })
    }
    if (onDeleteContext) {
      items.push({
        key: 'delete',
        label: deleteLabel,
        icon: 'trash' as const,
        danger: true,
        onSelect: () => requestDelete(id, name),
      })
    }
    return items
  }, [
    chipMenu,
    chipMenuContext,
    editLabel,
    deleteLabel,
    onOpenContext,
    onDeleteContext,
    requestDelete,
  ])

  const renderChip = (
    ctx: PlaneContextPoolItem,
    index: number,
    overflow = false,
  ) => {
    const menuOpen = chipMenu?.contextId === ctx.id
    const assignOpen = openContextId === ctx.id
    const summary = contextSummary(ctx)
    const label = [summary, chipActionHint ?? ''].filter(Boolean).join('. ')
    return (
      <div
        key={ctx.id}
        role="listitem"
        className={overflow ? 'plane-context-pool__item--overflow' : undefined}
        style={overflow ? {
          ['--plane-context-pool-chip-stagger' as string]: `${Math.max(0, index - barContexts.length) * 14}ms`,
        } : undefined}
      >
        <Tooltip content={summary} hint={chipActionHint}>
          <button
            type="button"
            className={[
              'plane-context-pool__chip',
              overflow ? 'plane-context-pool__chip--overflow' : '',
              menuOpen || assignOpen ? 'plane-context-pool__chip--open' : '',
            ].filter(Boolean).join(' ')}
            aria-haspopup="dialog"
            aria-expanded={menuOpen || assignOpen}
            aria-label={label}
            {...contextItemProps(ctx)}
            {...itemProps(index)}
          >
            <span
              className="plane-context-pool__chip-icon"
              style={{ color: ctx.color }}
            >
              <Icon name={ctx.icon} size={13} aria-hidden />
            </span>
            {assignedCount(ctx.id) > 0 ? (
              <span className="plane-context-pool__chip-pin" aria-hidden />
            ) : null}
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={[
        'plane-context-pool-shell',
        expanded ? 'plane-context-pool-shell--expanded' : '',
      ].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={title}
      onMouseDown={event => event.stopPropagation()}
      onPointerEnter={onPoolPointerEnter}
      onPointerLeave={onPoolPointerLeave}
      onFocusCapture={onPoolFocusIn}
      onBlurCapture={onPoolFocusOut}
      onKeyDown={onToolbarKeyDown}
    >
      {visibleContexts.length > 0 ? (
        <div
          className={[
            'plane-context-pool',
            expanded ? 'plane-context-pool--expanded' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="plane-context-pool__icons" role="list">
            {barContexts.map((ctx, index) => renderChip(ctx, index, false))}
            {overflowContexts.map((ctx, index) =>
              renderChip(ctx, barContexts.length + index, true),
            )}
          </div>

          {overflowContexts.length > 0 ? (
            <Tooltip content={t('tabs.planeContextPoolMore', { count: overflowContexts.length })}>
              <span
                className="plane-context-pool__overflow-badge"
                aria-label={t('tabs.planeContextPoolMore', { count: overflowContexts.length })}
              >
                +{overflowContexts.length}
              </span>
            </Tooltip>
          ) : null}
        </div>
      ) : null}

      <Tooltip content={configureLabel}>
        <button
          type="button"
          className="plane-context-pool__configure"
          aria-label={configureLabel}
          onClick={onConfigure}
          {...itemProps(visibleContexts.length)}
        >
          <Icon name="settings" size={12} />
        </button>
      </Tooltip>

      <Tooltip content={createLabel}>
        <button
          type="button"
          className="plane-context-pool__create"
          aria-label={createLabel}
          onClick={onCreate}
          {...itemProps(visibleContexts.length + 1)}
        >
          <Icon name="plus" size={12} />
        </button>
      </Tooltip>

      {chipMenu && chipMenuItems.length > 0 ? (
        <PlaneContextChipMenu
          anchor={chipMenu.anchor}
          items={chipMenuItems}
          onClose={() => setChipMenu(null)}
        />
      ) : null}

      <PlaneContextAssignModal
        open={Boolean(openContext)}
        context={openContext}
        previewContext={previewContext}
        cwd={cwd}
        agents={agents}
        assignLabel={assignLabel}
        assignEmptyHint={assignEmptyHint}
        editLabel={editLabel}
        onClose={closeAssignModal}
        onToggleAssign={onToggleAssign}
        onEdit={onOpenContext}
      />

      <ConfirmTerminalModal
        open={Boolean(pendingDelete)}
        zIndex={APP_OVERLAY_MODAL_Z + 20}
        message={deleteConfirmMessage(pendingDelete?.name ?? '')}
        detail={deleteConfirmDetail}
        onConfirm={() => {
          const id = pendingDelete?.id
          setPendingDelete(null)
          if (id) onDeleteContext?.(id)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
