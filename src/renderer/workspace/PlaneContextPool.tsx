import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { Input } from '../components/ui/Input'
import { Tooltip } from '../components/ui/Tooltip'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import {
  hasPlaneContextDrag,
  readPlaneContextDragData,
  setPlaneContextDragData,
} from './planeContextDrag'
import { PlaneContextAssignModal } from './PlaneContextAssignModal'
import {
  POOL_VISIBLE_CAP,
  assignedPaneIdsByContext,
  splitPoolContexts,
  type PlaneContextPoolAgent,
  type PlaneContextPoolItem,
} from './planeContextPoolLayout'
import './PlaneContextPool.css'

export type { PlaneContextPoolAgent, PlaneContextPoolItem } from './planeContextPoolLayout'

/**
 * Chromium rasteriza el fantasma del arrastre sobre un fondo opaco cuando el
 * elemento cuelga de un contenedor con `backdrop-filter` (la barra es glass):
 * salen esquinas rectas blancas. Se arrastra un clon colgado del `body`, fuera
 * de ese contexto, para que respete el radio y la transparencia.
 */
function setChipDragImage(event: React.DragEvent<HTMLButtonElement>): void {
  const ghost = event.currentTarget.cloneNode(true) as HTMLElement
  ghost.classList.add('plane-context-pool__chip--ghost')
  document.body.appendChild(ghost)
  // Se mide el clon, no el origen: la fila del popover mide 292 px pero su
  // fantasma se reduce al mismo chip de la barra, y con el ancla del origen
  // el puntero acababa a media fila de distancia.
  const { width, height } = ghost.getBoundingClientRect()
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
  const { t } = useT()
  const dragOccurredRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rovingIndex, setRovingIndex] = useState(0)
  /** Id del chip en arrastre: muestra la papelera a la izquierda de los chips. */
  const [draggingContextId, setDraggingContextId] = useState<string | null>(null)
  /** Aparta el popover una vez arrancado el arrastre (ver `onDragStart`). */
  const [overflowHidden, setOverflowHidden] = useState(false)
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
  const assignedCount = useCallback(
    (contextId: string) => (assignedByContext[contextId] ?? []).length,
    [assignedByContext],
  )
  const { visible: barContexts, overflow: overflowContexts } = useMemo(
    () => splitPoolContexts(visibleContexts, assignedCount),
    [visibleContexts, assignedCount],
  )
  /**
   * El popover lista el catálogo completo, no solo lo que sobra: buscar «api» y
   * no encontrarlo porque justo ese chip sí cabía sería peor que no buscar.
   */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return visibleContexts
    return visibleContexts.filter(ctx => (
      ctx.name.toLowerCase().includes(needle)
      || ctx.kindLabel.toLowerCase().includes(needle)
    ))
  }, [visibleContexts, query])
  const inUseMatches = matches.filter(ctx => assignedCount(ctx.id) > 0)
  const freeMatches = matches.filter(ctx => assignedCount(ctx.id) === 0)

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

  // Si el catálogo encoge por debajo del tope ya no hay nada que desbordar.
  useEffect(() => {
    if (overflowContexts.length === 0) setOverflowOpen(false)
  }, [overflowContexts.length])

  useEffect(() => {
    if (!overflowOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOverflowOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOverflowOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [overflowOpen])

  const toggleOverflow = useCallback(() => {
    setQuery('')
    setOpenContextId(null)
    setOverflowOpen(open => !open)
  }, [])

  /** Roving tabindex: la barra entera es una sola parada de tabulación. */
  const onToolbarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    // Dentro del popover las flechas son del buscador, no de la barra.
    if ((event.target as HTMLElement).closest('.plane-context-pool__overflow')) return
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

  /** El chip de la barra y la fila del popover son el mismo gesto: clic asigna, arrastrar también. */
  const contextItemProps = (ctx: PlaneContextPoolItem) => ({
    draggable: true,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (dragOccurredRef.current) {
        dragOccurredRef.current = false
        return
      }
      setOverflowOpen(false)
      setOpenContextId(current => (current === ctx.id ? null : ctx.id))
    },
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
    },
    onDragStart: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      dragOccurredRef.current = true
      setOpenContextId(null)
      setDraggingContextId(ctx.id)
      setPlaneContextDragData(event.dataTransfer, ctx.id)
      setChipDragImage(event)
      // Chromium cancela el arrastre si el origen (o un ancestro) cambia de
      // visibilidad dentro del propio `dragstart`, y para la fila del popover
      // ocultarlo es exactamente eso. Se aplaza un tick, cuando el arrastre ya
      // está en curso. Ni desmontarlo ni `opacity: 0` síncronos valen aquí.
      window.setTimeout(() => setOverflowHidden(true), 0)
    },
    onDragEnd: (event: React.DragEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      endChipDrag()
    },
  })

  /** Tooltip/aria del chip y de la fila: nombre, kind y a cuántos agentes está asignado. */
  const contextSummary = (ctx: PlaneContextPoolItem): string => {
    const count = assignedCount(ctx.id)
    return [
      `${ctx.name} — ${ctx.kindLabel}`,
      count > 0 ? assignedCountLabel(count) : '',
    ].filter(Boolean).join(' · ')
  }

  const closeAssignModal = useCallback(() => setOpenContextId(null), [])

  const endChipDrag = useCallback(() => {
    setDraggingContextId(null)
    setOverflowHidden(false)
    setOverflowOpen(false)
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

      {barContexts.length > 0 ? (
        <div className="plane-context-pool__icons" role="list">
          {barContexts.map((ctx, index) => {
            const open = openContextId === ctx.id
            const summary = contextSummary(ctx)
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
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={label}
                    {...contextItemProps(ctx)}
                    {...itemProps(index + 2)}
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
          })}
        </div>
      ) : null}

      {overflowContexts.length > 0 ? (
        <Tooltip content={t('tabs.planeContextPoolMore', { count: overflowContexts.length })}>
          <button
            type="button"
            className={[
              'plane-context-pool__more',
              overflowOpen ? 'plane-context-pool__more--open' : '',
            ].filter(Boolean).join(' ')}
            aria-haspopup="dialog"
            aria-expanded={overflowOpen}
            aria-label={t('tabs.planeContextPoolMore', { count: overflowContexts.length })}
            onClick={toggleOverflow}
            {...itemProps(barContexts.length + 2)}
          >
            +{overflowContexts.length}
            <Icon name="chevron-down" size={10} aria-hidden />
          </button>
        </Tooltip>
      ) : null}

      {overflowOpen ? (
        <div
          className={[
            'plane-context-pool__overflow',
            overflowHidden ? 'plane-context-pool__overflow--dragging' : '',
          ].filter(Boolean).join(' ')}
          role="dialog"
          aria-label={title}
          data-plane-native-scroll=""
          data-testid="plane-context-pool-overflow"
        >
          <div className="plane-context-pool__overflow-search">
            <Input
              size="sm"
              autoFocus
              value={query}
              placeholder={t('tabs.planeContextPoolSearch')}
              aria-label={t('tabs.planeContextPoolSearch')}
              onChange={event => setQuery(event.target.value)}
            />
          </div>

          <div className="plane-context-pool__overflow-list">
            {matches.length === 0 ? (
              <p className="plane-context-pool__overflow-empty">
                {t('tabs.planeContextPoolNoMatch')}
              </p>
            ) : null}
            {([
              [t('tabs.planeContextPoolInUse'), inUseMatches],
              [t('tabs.planeContextPoolFree'), freeMatches],
            ] as const).map(([groupLabel, group]) => (
              group.length === 0 ? null : (
                <React.Fragment key={groupLabel}>
                  <p className="plane-context-pool__overflow-group">
                    {groupLabel} <span>{group.length}</span>
                  </p>
                  {group.map(ctx => (
                    <button
                      key={ctx.id}
                      type="button"
                      className="plane-context-pool__row"
                      aria-haspopup="dialog"
                      aria-label={contextSummary(ctx)}
                      {...contextItemProps(ctx)}
                    >
                      <span
                        className="plane-context-pool__row-icon"
                        style={{ color: ctx.color }}
                      >
                        <Icon name={ctx.icon} size={13} aria-hidden />
                      </span>
                      <span className="plane-context-pool__row-name">{ctx.name}</span>
                      <span className="plane-context-pool__row-kind">{ctx.kindLabel}</span>
                      {assignedCount(ctx.id) > 0 ? (
                        <span className="plane-context-pool__row-count">
                          {assignedCount(ctx.id)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </React.Fragment>
              )
            ))}
          </div>

          <p className="plane-context-pool__overflow-hint">{chipActionHint}</p>
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
