import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { setPlaneContextDragData } from './planeContextDrag'
import {
  allowArmedHtml5DragStart,
  armHtml5DragOnMouseDown,
  createHtml5DragArm,
  disarmHtml5Drag,
} from '../html5DragArm'
import { PlaneContextAssignModal } from './PlaneContextAssignModal'
import { PlaneContextChipMenu } from './PlaneContextChipMenu'
import type { PlaneContextChipMenuItem } from './PlaneContextChipMenu'
import {
  assignedPaneIdsByContext,
  listPoolContexts,
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
  /** Abre el picker nativo y crea un contexto files por archivo. */
  addFileLabel?: string
  onAddFile?: () => void
  /** Abre el modal de contextos directo en el formulario de creación. */
  onCreate: () => void
  /** Abre ese contexto para editarlo. */
  onOpenContext?: (contextId: string) => void
  /** Elimina el contexto (tras ConfirmTerminalModal en el menú del chip). */
  onDeleteContext?: (contextId: string) => void
  /** Asigna/desasigna un contexto a un agente. */
  onToggleAssign: (paneId: string, contextId: string) => void
  /** Sube el z-index cuando un overlay del plano está abierto. */
  elevated?: boolean
}

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
  addFileLabel,
  onAddFile,
  onCreate,
  onOpenContext,
  onDeleteContext,
  onToggleAssign,
  elevated = false,
}) => {
  const { t } = useT()
  const dragOccurredRef = useRef(false)
  const chipDragArmRef = useRef(createHtml5DragArm())
  const rootRef = useRef<HTMLDivElement>(null)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
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
  const poolContexts = useMemo(
    () => listPoolContexts(visibleContexts, assignedCount),
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

  /** Roving tabindex: la barra entera es una sola parada de tabulación. */
  const onToolbarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pool-item]'))
    const from = items.indexOf(document.activeElement as HTMLElement)
    if (from < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
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
    draggable: false,
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
    onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => {
      armHtml5DragOnMouseDown(event.currentTarget, chipDragArmRef.current, event.button)
    },
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
    },
    onDragStart: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      if (!allowArmedHtml5DragStart(
        event.currentTarget,
        chipDragArmRef.current,
        () => event.preventDefault(),
      )) {
        return
      }
      dragOccurredRef.current = true
      setDraggingChip(true)
      setOpenContextId(null)
      setChipMenu(null)
      setPlaneContextDragData(event.dataTransfer, ctx.id)
      setChipDragImage(event)
    },
    onDragEnd: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      disarmHtml5Drag(event.currentTarget, chipDragArmRef.current)
      setDraggingChip(false)
      endChipDrag()
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

  const renderChip = (ctx: PlaneContextPoolItem, index: number) => {
    const menuOpen = chipMenu?.contextId === ctx.id
    const assignOpen = openContextId === ctx.id
    const summary = contextSummary(ctx)
    const label = [summary, chipActionHint ?? ''].filter(Boolean).join('. ')
    return (
      <div key={ctx.id} role="listitem">
        <Tooltip content={summary} hint={chipActionHint}>
          <button
            type="button"
            className={[
              'plane-context-pool__chip',
              menuOpen || assignOpen ? 'plane-context-pool__chip--open' : '',
            ].filter(Boolean).join(' ')}
            data-context-pool-chip={ctx.id}
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
        draggingChip ? 'plane-context-pool-shell--dragging' : '',
        elevated ? 'plane-context-pool-shell--elevated' : '',
      ].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={title}
      onMouseDown={event => event.stopPropagation()}
      onKeyDown={onToolbarKeyDown}
    >
      {visibleContexts.length > 0 ? (
        <div className="plane-context-pool">
          <div className="plane-context-pool__icons" role="list">
            {poolContexts.map((ctx, index) => renderChip(ctx, index))}
          </div>
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

      {onAddFile ? (
        <Tooltip content={addFileLabel}>
          <button
            type="button"
            className="plane-context-pool__add-file"
            aria-label={addFileLabel}
            onClick={onAddFile}
            {...itemProps(visibleContexts.length + 1)}
          >
            <Icon name="files" size={12} />
          </button>
        </Tooltip>
      ) : null}

      <Tooltip content={createLabel}>
        <button
          type="button"
          className="plane-context-pool__create"
          aria-label={createLabel}
          onClick={onCreate}
          {...itemProps(visibleContexts.length + (onAddFile ? 2 : 1))}
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
