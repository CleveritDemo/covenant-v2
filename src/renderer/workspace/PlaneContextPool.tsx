import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import {
  hasPlaneContextDrag,
  readPlaneContextDragData,
  setPlaneContextDragData,
} from './planeContextDrag'
import { PlaneContextAssignModal } from './PlaneContextAssignModal'
import './PlaneContextPool.css'

export interface PlaneContextPoolItem {
  id: string
  name: string
  kind: TabContextKind
  kindLabel: string
  icon: IconName
  color: string
}

/** Agente del plano al que se le puede asignar un contexto. */
export interface PlaneContextPoolAgent {
  paneId: string
  title: string
  contextIds: string[]
}

/** Cuántos/qué agentes tienen ya asignado cada contexto. */
export function assignedPaneIdsByContext(
  agents: PlaneContextPoolAgent[],
): Record<string, string[]> {
  const byContext: Record<string, string[]> = {}
  for (const agent of agents) {
    for (const contextId of new Set(agent.contextIds)) {
      const paneIds = byContext[contextId] ?? (byContext[contextId] = [])
      paneIds.push(agent.paneId)
    }
  }
  return byContext
}

/**
 * Chromium rasteriza el fantasma del arrastre sobre un fondo opaco cuando el
 * elemento cuelga de un contenedor con `backdrop-filter` (la barra es glass):
 * salen esquinas rectas blancas. Se arrastra un clon colgado del `body`, fuera
 * de ese contexto, para que respete el radio y la transparencia.
 */
function setChipDragImage(event: React.DragEvent<HTMLButtonElement>): void {
  const ghost = event.currentTarget.cloneNode(true) as HTMLElement
  ghost.classList.add('plane-context-pool__chip--ghost')
  const { width, height } = event.currentTarget.getBoundingClientRect()
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, width / 2, height / 2)
  // El fantasma solo hace falta durante el snapshot síncrono del dragstart.
  window.setTimeout(() => ghost.remove(), 0)
}

export interface PlaneContextPoolProps {
  title: string
  configureLabel: string
  createLabel: string
  /** Hint del chip (segunda línea del tooltip + aria): clic asigna, arrastrar también. */
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
  /** Aria de la zona soltar-para-borrar (visible solo al arrastrar). */
  trashDropLabel: string
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
  /** Elimina el contexto (tras ConfirmTerminalModal en assign o trash drop). */
  onDeleteContext?: (contextId: string) => void
  /** Asigna/desasigna un contexto a un agente. */
  onToggleAssign: (paneId: string, contextId: string) => void
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
  trashDropLabel,
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
  const dragOccurredRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
  const [rovingIndex, setRovingIndex] = useState(0)
  /** Id del chip en arrastre: muestra la papelera a la izquierda de los chips. */
  const [draggingContextId, setDraggingContextId] = useState<string | null>(null)
  const [trashHot, setTrashHot] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const visibleContexts = useMemo(
    () => contexts.filter(isProjectContext),
    [contexts],
  )
  const assignedByContext = useMemo(
    () => assignedPaneIdsByContext(agents),
    [agents],
  )
  const openContext = openContextId
    ? visibleContexts.find(ctx => ctx.id === openContextId) ?? null
    : null
  const previewContext = openContextId
    ? contextCatalog.find(ctx => ctx.id === openContextId) ?? null
    : null

  // El contexto abierto puede desaparecer (borrado desde el modal).
  useEffect(() => {
    if (openContextId && !openContext) setOpenContextId(null)
  }, [openContextId, openContext])

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

  const closeAssignModal = useCallback(() => setOpenContextId(null), [])

  const endChipDrag = useCallback(() => {
    setDraggingContextId(null)
    setTrashHot(false)
    window.setTimeout(() => {
      dragOccurredRef.current = false
    }, 50)
  }, [])

  const requestDelete = useCallback((contextId: string, name: string) => {
    if (!onDeleteContext) return
    setPendingDelete({ id: contextId, name })
  }, [onDeleteContext])

  const showTrash = Boolean(draggingContextId && onDeleteContext)

  return (
    <div
      ref={rootRef}
      className={[
        'plane-context-pool',
        visibleContexts.length === 0 ? 'plane-context-pool--empty' : '',
        showTrash ? 'plane-context-pool--dragging' : '',
      ].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={title}
      onMouseDown={event => event.stopPropagation()}
      onKeyDown={onToolbarKeyDown}
    >
      <Tooltip content={configureLabel}>
        <button
          type="button"
          className="plane-context-pool__configure"
          aria-label={configureLabel}
          onClick={onConfigure}
          {...itemProps(0)}
        >
          <Icon name="settings" size={12} />
        </button>
      </Tooltip>

      <Tooltip content={createLabel}>
        <button
          type="button"
          className="plane-context-pool__configure"
          aria-label={createLabel}
          onClick={onCreate}
          {...itemProps(1)}
        >
          <Icon name="plus" size={12} />
        </button>
      </Tooltip>

      {showTrash ? (
        <div
          className={[
            'plane-context-pool__trash',
            trashHot ? 'plane-context-pool__trash--hot' : '',
          ].filter(Boolean).join(' ')}
          role="button"
          aria-label={trashDropLabel}
          data-testid="plane-context-pool-trash"
          onDragEnter={event => {
            if (!hasPlaneContextDrag(event.dataTransfer)) return
            event.preventDefault()
            setTrashHot(true)
          }}
          onDragOver={event => {
            if (!hasPlaneContextDrag(event.dataTransfer)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setTrashHot(true)
          }}
          onDragLeave={event => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setTrashHot(false)
          }}
          onDrop={event => {
            event.preventDefault()
            event.stopPropagation()
            const droppedId = readPlaneContextDragData(event.dataTransfer)
              || draggingContextId
            endChipDrag()
            if (!droppedId) return
            const target = visibleContexts.find(ctx => ctx.id === droppedId)
            if (!target) return
            requestDelete(target.id, target.name)
          }}
        >
          <Icon name="trash" size={12} aria-hidden />
        </div>
      ) : null}

      {visibleContexts.length > 0 ? (
        <div className="plane-context-pool__icons" role="list">
          {visibleContexts.map((ctx, index) => {
            const assignedCount = (assignedByContext[ctx.id] ?? []).length
            const open = openContextId === ctx.id
            const summary = [
              `${ctx.name} — ${ctx.kindLabel}`,
              assignedCount > 0 ? assignedCountLabel(assignedCount) : '',
            ].filter(Boolean).join(' · ')
            const label = [summary, chipActionHint ?? ''].filter(Boolean).join('. ')
            return (
              <div key={ctx.id} role="listitem">
                <Tooltip content={summary} hint={chipActionHint}>
                  <button
                    type="button"
                    className={[
                      'plane-context-pool__chip',
                      open ? 'plane-context-pool__chip--open' : '',
                    ].filter(Boolean).join(' ')}
                    draggable
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={label}
                    onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (dragOccurredRef.current) {
                        dragOccurredRef.current = false
                        return
                      }
                      setOpenContextId(current => (current === ctx.id ? null : ctx.id))
                    }}
                    onPointerDown={event => {
                      event.stopPropagation()
                    }}
                    onDragStart={event => {
                      event.stopPropagation()
                      dragOccurredRef.current = true
                      setOpenContextId(null)
                      setDraggingContextId(ctx.id)
                      setPlaneContextDragData(event.dataTransfer, ctx.id)
                      setChipDragImage(event)
                    }}
                    onDragEnd={event => {
                      event.stopPropagation()
                      endChipDrag()
                    }}
                    {...itemProps(index + 2)}
                  >
                    <span
                      className="plane-context-pool__chip-icon"
                      style={{ color: ctx.color }}
                    >
                      <Icon name={ctx.icon} size={13} aria-hidden />
                    </span>
                  </button>
                </Tooltip>
              </div>
            )
          })}
        </div>
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
        deleteLabel={deleteLabel}
        deleteConfirmMessage={deleteConfirmMessage(openContext?.name ?? '')}
        deleteConfirmDetail={deleteConfirmDetail}
        onClose={closeAssignModal}
        onToggleAssign={onToggleAssign}
        onEdit={onOpenContext}
        onDelete={onDeleteContext}
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
