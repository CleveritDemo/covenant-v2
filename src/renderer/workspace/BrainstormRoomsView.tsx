import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainstormRoom, BrainstormStatus } from '@shared/brainstormRoom'
import {
  formatBrainstormClosing,
  formatCeremonyClosing,
  parseBrainstormClosing,
  parseCeremonyClosing,
  resolveBrainstormParticipantDisplay,
} from '@shared/brainstormRoom'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  brainstormAge,
  brainstormPrimaryAction,
  brainstormRoomContext,
  brainstormRoundsDone,
  brainstormTone,
  filterBrainstormRooms,
  groupBrainstormRooms,
  type BrainstormGroupKey,
  type BrainstormRoomListing,
} from '@shared/brainstormListing'
import { BRAINSTORM_DIR, brainstormFileName, buildBrainstormMarkdown } from '@shared/brainstormCatalog'
import { agentMonogram } from '@shared/tabContextAppearance'
import { PROJECT_DIR } from '@shared/projectDir'
import { ceremonyById, type CeremonyId } from '@shared/agileCeremonies'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { Button, Icon, Input, Tooltip } from '../components/ui'
import { BrainstormOverlay } from './BrainstormOverlay'
import { BrainstormModuleTabs } from './BrainstormModuleTabs'
import { BrainstormEditRoomModal } from './BrainstormEditRoomModal'
import { BrainstormRoomMenu, type BrainstormRoomMenuItem } from './BrainstormRoomMenu'
import './BrainstormRoomsView.css'

export interface BrainstormRoomsViewProps {
  open: boolean
  active?: boolean
  cwd: string
  /** Catálogo del proyecto: monogramas de la fila y reinvitar en salas `idle`. */
  agents?: ProjectAgentDefinition[]
  onClose: () => void
  onCreate: () => void
  onOpenRoom: (room: BrainstormRoom) => void
  /** Una sala se registró como contexto: refrescar la lista de la pestaña. */
  onContextSaved?: () => void
}

/** Filtro por estado: la pregunta frecuente es «¿cuáles cerraron?». */
type StatusFilter = 'all' | 'closed' | 'stopped'

function statusLabelKey(
  status: BrainstormStatus,
): 'tabs.brainstormStatusRunning'
  | 'tabs.brainstormStatusDone'
  | 'tabs.brainstormStatusStopped'
  | 'tabs.brainstormStatusPaused'
  | 'tabs.brainstormStatusIdle' {
  if (status === 'running') return 'tabs.brainstormStatusRunning'
  if (status === 'done') return 'tabs.brainstormStatusDone'
  if (status === 'stopped') return 'tabs.brainstormStatusStopped'
  if (status === 'paused') return 'tabs.brainstormStatusPaused'
  return 'tabs.brainstormStatusIdle'
}

function groupLabelKey(
  key: BrainstormGroupKey,
): 'tabs.brainstormsGroupLive' | 'tabs.brainstormsGroupRecent' | 'tabs.brainstormsGroupOlder' {
  if (key === 'live') return 'tabs.brainstormsGroupLive'
  if (key === 'recent') return 'tabs.brainstormsGroupRecent'
  return 'tabs.brainstormsGroupOlder'
}

/** Una sala cerrada es la que ya deja material: ahí valen exportar y «al contexto». */
function isClosedRoom(status: BrainstormStatus): boolean {
  return status === 'done' || status === 'stopped'
}

/**
 * Lo que se guarda como contexto: el cierre si lo hay —es la decisión— y si no,
 * el acta completa. Mismo archivo que escribe la tarjeta de cierre de la sala.
 */
function roomContextMarkdown(room: BrainstormRoom): string {
  const last = room.messages[room.messages.length - 1]
  if (!last) return buildBrainstormMarkdown(room)
  const ceremonyClosing = parseCeremonyClosing(last.text, room.ceremony)
  if (ceremonyClosing) return formatCeremonyClosing(room.topic, ceremonyClosing)
  const closing = parseBrainstormClosing(last.text)
  return closing ? formatBrainstormClosing(room.topic, closing) : buildBrainstormMarkdown(room)
}

const FEEDBACK_MS = 1500
const LIVE_REFRESH_MS = 2000
const PRUNE_FEEDBACK_MS = 2500
/** Monogramas visibles antes de resumir en «+N». */
const MAX_MONOGRAMS = 4

/**
 * Biblioteca de salas sobre el plano: es el estado por el que se entra al módulo
 * cuando ya hay actas. Antes era un modal portaleado, así que leer tu propia
 * acta obligaba a salir del plano; ahora es la tercera vista del mismo overlay
 * —`Rooms`, `New room` y la sala— con el mismo chrome y el mismo Escape.
 *
 * Una acción primaria por estado, el resto detrás del `⋯`.
 */
export const BrainstormRoomsView: React.FC<BrainstormRoomsViewProps> = ({
  open,
  active = true,
  cwd,
  agents = [],
  onClose,
  onCreate,
  onOpenRoom,
  onContextSaved,
}) => {
  const { t } = useT()
  const [rooms, setRooms] = useState<BrainstormRoomListing[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BrainstormRoom | null>(null)
  const [editingRoom, setEditingRoom] = useState<BrainstormRoom | null>(null)
  const [menuFor, setMenuFor] = useState<{ room: BrainstormRoom; right: number; bottom: number } | null>(null)
  /** id → clave del texto de confirmación efímero de su acción. */
  const [doneById, setDoneById] = useState<Record<string, 'context' | 'export' | 'path'>>({})
  const [pruneFeedback, setPruneFeedback] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const doneTimersRef = useRef<Map<string, number>>(new Map())
  const pruneTimerRef = useRef<number | null>(null)

  const refresh = useCallback(async (opts?: { silent?: boolean }): Promise<void> => {
    if (loadingRef.current) return
    const root = cwd.trim()
    if (!root) {
      setRooms([])
      return
    }
    loadingRef.current = true
    if (!opts?.silent) setLoading(true)
    try {
      const listed = await window.api.listBrainstorms(root)
      setRooms(listed)
      setNow(Date.now())
    } catch {
      setRooms([])
    } finally {
      loadingRef.current = false
      if (!opts?.silent) setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setStatusFilter('all')
    setCeremonyFilter('')
    void refresh()
    const timer = window.setInterval(() => {
      void refresh({ silent: true })
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [open, refresh])

  useEffect(() => () => {
    for (const timer of doneTimersRef.current.values()) window.clearTimeout(timer)
    doneTimersRef.current.clear()
    if (pruneTimerRef.current != null) window.clearTimeout(pruneTimerRef.current)
  }, [])

  const flashDone = useCallback((roomId: string, kind: 'context' | 'export' | 'path'): void => {
    setDoneById(prev => ({ ...prev, [roomId]: kind }))
    const prevTimer = doneTimersRef.current.get(roomId)
    if (prevTimer != null) window.clearTimeout(prevTimer)
    const timer = window.setTimeout(() => {
      setDoneById(prev => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      doneTimersRef.current.delete(roomId)
    }, FEEDBACK_MS)
    doneTimersRef.current.set(roomId, timer)
  }, [])

  /**
   * Estado y formato como filtros de la columna, no como parte de la búsqueda:
   * son las dos preguntas que no se responden escribiendo un texto.
   */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ceremonyFilter, setCeremonyFilter] = useState<string>('')

  const statusCounts = useMemo(() => ({
    all: rooms.length,
    closed: rooms.filter(room => room.status === 'done').length,
    stopped: rooms.filter(room => room.status === 'stopped').length,
  }), [rooms])

  /** Formatos presentes, con su cuenta: filtrar por uno que no existe no sirve. */
  const ceremonyCounts = useMemo(() => {
    const counts = new Map<string, number>()
    rooms.forEach(room => {
      const id = room.ceremony ?? ''
      if (!id) return
      counts.set(id, (counts.get(id) ?? 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rooms])

  const groups = useMemo(() => {
    const matching = rooms.filter(room => {
      if (statusFilter === 'closed' && room.status !== 'done') return false
      if (statusFilter === 'stopped' && room.status !== 'stopped') return false
      if (ceremonyFilter && room.ceremony !== ceremonyFilter) return false
      return true
    })
    return groupBrainstormRooms(filterBrainstormRooms(matching, query), now)
  }, [ceremonyFilter, now, query, rooms, statusFilter])

  const ageLabel = useCallback((room: BrainstormRoomListing): string => {
    const age = brainstormAge(room.updatedAt, now)
    if (!age) {
      return typeof room.updatedAt === 'number'
        ? new Date(room.updatedAt).toLocaleDateString()
        : ''
    }
    if (age.unit === 'now') return t('tabs.brainstormsAgeNow')
    if (age.unit === 'minutes') return t('tabs.brainstormsAgeMinutes', { count: age.count })
    if (age.unit === 'hours') return t('tabs.brainstormsAgeHours', { count: age.count })
    return t('tabs.brainstormsAgeDays', { count: age.count })
  }, [now, t])

  const monogramOf = useCallback((agentId: string): string => {
    const display = resolveBrainstormParticipantDisplay(agentId, agents)
    const agent = agents.find(item => item.id === display.agentId)
    return agent?.monogram?.trim() || agentMonogram(display.label)
  }, [agents])

  const handleCopyPath = useCallback((room: BrainstormRoom): void => {
    const root = cwd.trim()
    if (!root) return
    // ponytail: asume `.gravity`; un proyecto aún en `.iaterminal` copia la ruta nueva.
    // Arreglar exponiendo la carpeta resuelta por IPC si alguien se queja.
    const path = `${root}/${PROJECT_DIR}/${BRAINSTORM_DIR}/${brainstormFileName(room.id)}`
    void navigator.clipboard.writeText(path)
      .then(() => flashDone(room.id, 'path'))
      .catch(() => {})
  }, [cwd, flashDone])

  const handleExportMd = useCallback(async (room: BrainstormRoom): Promise<void> => {
    const root = cwd.trim()
    if (!root) return
    try {
      const result = await window.api.exportBrainstormMarkdown(root, room.id)
      if (result.ok) flashDone(room.id, 'export')
    } catch {
      /* ignore export failures */
    }
  }, [cwd, flashDone])

  const handleToContext = useCallback(async (room: BrainstormRoom): Promise<void> => {
    const root = cwd.trim()
    if (!root) return
    const result = await window.api.materializeTabContext({
      context: brainstormRoomContext(room),
      cwd: root,
      content: roomContextMarkdown(room),
    })
    if (!result.ok) return
    flashDone(room.id, 'context')
    onContextSaved?.()
  }, [cwd, flashDone, onContextSaved])

  const confirmDelete = useCallback(async (): Promise<void> => {
    const room = pendingDelete
    setPendingDelete(null)
    if (!room) return
    const root = cwd.trim()
    if (!root) return
    await window.api.deleteBrainstorm(root, room.id)
    await refresh({ silent: true })
  }, [cwd, pendingDelete, refresh])

  const handlePrune = useCallback(async (): Promise<void> => {
    const root = cwd.trim()
    if (!root) return
    const result = await window.api.pruneBrainstorms(root)
    if (!result.ok) return
    setPruneFeedback(t('tabs.brainstormsPruneResult', { count: result.removed }))
    if (pruneTimerRef.current != null) window.clearTimeout(pruneTimerRef.current)
    pruneTimerRef.current = window.setTimeout(() => {
      setPruneFeedback(null)
      pruneTimerRef.current = null
    }, PRUNE_FEEDBACK_MS)
    await refresh({ silent: true })
  }, [cwd, refresh, t])

  const primaryLabel = (status: BrainstormStatus): string => {
    const action = brainstormPrimaryAction(status)
    if (action === 'live') return t('tabs.brainstormsLive')
    if (action === 'resume') return t('tabs.brainstormsResume')
    return t('tabs.brainstormsOpen')
  }

  const menuItems = (room: BrainstormRoom): BrainstormRoomMenuItem[] => [
    ...(room.status === 'running' ? [] : [{
      key: 'edit',
      label: t('tabs.brainstormsEdit'),
      icon: 'pencil' as const,
      onSelect: () => setEditingRoom(room),
    }]),
    {
      key: 'context',
      label: t('tabs.brainstormsToContext'),
      icon: 'plus' as const,
      onSelect: () => { void handleToContext(room) },
    },
    {
      key: 'export',
      label: t('tabs.brainstormsExportMd'),
      icon: 'download' as const,
      onSelect: () => { void handleExportMd(room) },
    },
    {
      key: 'path',
      label: t('tabs.brainstormsCopyPath'),
      icon: 'files' as const,
      onSelect: () => handleCopyPath(room),
    },
    {
      key: 'delete',
      label: t('tabs.brainstormsDelete'),
      icon: 'trash' as const,
      danger: true,
      onSelect: () => setPendingDelete(room),
    },
  ]

  if (!open) return null

  return (
    <>
      <BrainstormOverlay
        active={active}
        variant="setup"
        ariaLabel={t('tabs.brainstormsListTitle')}
        closeLabel={t('tabs.brainstormCloseView')}
        onClose={onClose}
        chrome={(
          <BrainstormModuleTabs
            tab="rooms"
            roomsCount={rooms.length}
            onRooms={() => {}}
            onNew={onCreate}
          />
        )}
        left={(
          <>
            {/* Estado y formato: lo que el pie del modal no podía preguntar. */}
            <section className="brainstorm-panel">
              <span className="brainstorm-panel__title">
                {t('tabs.brainstormsFilterStatus')}
              </span>
              <div className="brainstorm-rooms__filters">
                {([
                  ['all', t('tabs.brainstormsFilterAll'), statusCounts.all],
                  ['closed', t('tabs.brainstormStatusDone'), statusCounts.closed],
                  ['stopped', t('tabs.brainstormStatusStopped'), statusCounts.stopped],
                ] as [StatusFilter, string, number][]).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    className={[
                      'brainstorm-rooms__filter',
                      statusFilter === value ? 'brainstorm-rooms__filter--on' : '',
                    ].filter(Boolean).join(' ')}
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                    <i>{count}</i>
                  </button>
                ))}
              </div>
            </section>

            {ceremonyCounts.length > 1 ? (
              <section className="brainstorm-panel">
                <span className="brainstorm-panel__title">
                  {t('tabs.brainstormFormatLabel')}
                </span>
                <div className="brainstorm-rooms__filters">
                  <button
                    type="button"
                    className={[
                      'brainstorm-rooms__filter',
                      ceremonyFilter ? '' : 'brainstorm-rooms__filter--on',
                    ].filter(Boolean).join(' ')}
                    aria-pressed={!ceremonyFilter}
                    onClick={() => setCeremonyFilter('')}
                  >
                    {t('tabs.brainstormsFilterAll')}
                  </button>
                  {ceremonyCounts.map(([id, count]) => (
                    <button
                      key={id}
                      type="button"
                      className={[
                        'brainstorm-rooms__filter',
                        ceremonyFilter === id ? 'brainstorm-rooms__filter--on' : '',
                      ].filter(Boolean).join(' ')}
                      aria-pressed={ceremonyFilter === id}
                      onClick={() => setCeremonyFilter(id)}
                    >
                      {ceremonyById(id as CeremonyId).name}
                      <i>{count}</i>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Borrar actas viejas no es una acción sobre una sala: fuera del pie,
                donde competía con el primario. */}
            <section className="brainstorm-panel">
              <span className="brainstorm-panel__title">
                {t('tabs.brainstormsHousekeeping')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { void handlePrune() }}
                disabled={!cwd.trim()}
              >
                {t('tabs.brainstormsPruneOld')}
              </Button>
              {pruneFeedback ? (
                <span className="brainstorm-panel__hint">{pruneFeedback}</span>
              ) : null}
            </section>
          </>
        )}
      >
        <div className="brainstorm-rooms">
        {rooms.length > 0 ? (
          <div className="brainstorm-rooms__search">
            <Icon name="search" size={14} aria-hidden />
            <Input
              size="sm"
              variant="inline"
              value={query}
              placeholder={t('tabs.brainstormsFilterPlaceholder')}
              aria-label={t('tabs.brainstormsFilterPlaceholder')}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        ) : null}
        {loading ? (
          <p className="brainstorm-rooms__hint">{t('tabs.brainstormsListLoading')}</p>
        ) : rooms.length === 0 ? (
          <div className="brainstorm-rooms__empty">
            <Icon name="messages" size={30} aria-hidden />
            <h3 className="brainstorm-rooms__empty-title">{t('tabs.brainstormsListEmpty')}</h3>
            <p className="brainstorm-rooms__empty-body">{t('tabs.brainstormsEmptyBody')}</p>
            {/* Sin actas, la única salida es convocar: aquí el CTA no duplica
                nada porque el pie del modal ya no existe. */}
            <Button variant="primary" size="sm" onClick={onCreate}>
              {t('tabs.brainstormsCreateNew')}
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="brainstorm-rooms__hint">{t('tabs.brainstormsFilterEmpty')}</p>
        ) : (
          <div className="brainstorm-rooms__groups">
            {groups.map(group => (
              <section key={group.key} className="brainstorm-rooms__group">
                <h3 className="brainstorm-rooms__group-title">
                  {t(groupLabelKey(group.key))}
                </h3>
                <ul className="brainstorm-rooms__list">
                  {group.rooms.map(room => {
                    const tone = brainstormTone(room.status)
                    const done = brainstormRoundsDone(room)
                    const age = ageLabel(room)
                    const closed = isClosedRoom(room.status)
                    const flash = doneById[room.id]
                    return (
                      <li
                        key={room.id}
                        className={[
                          'brainstorm-rooms__row',
                          `brainstorm-rooms__row--${tone}`,
                          group.key === 'older' ? 'brainstorm-rooms__row--faded' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {/*
                          La fila entera abre el acta: con eso el botón «Abrir»
                          sobra y las acciones dejan de competir con él. La capa
                          va debajo de las acciones, así no hay botones anidados.
                        */}
                        <button
                          type="button"
                          className="brainstorm-rooms__hit"
                          aria-label={`${primaryLabel(room.status)}: ${room.topic}`}
                          onClick={() => onOpenRoom(room)}
                        />
                        {/* Único elemento con color: el estado. */}
                        <i className="brainstorm-rooms__dot" aria-hidden />
                        <div className="brainstorm-rooms__main">
                          <span className="brainstorm-rooms__topic">{room.topic}</span>
                          <span className="brainstorm-rooms__facts">
                            {/* En palabras solo lo que no es normal: una lista de
                                «Listo» repetido no dice nada; una interrumpida sí. */}
                            {room.status === 'done' ? null : (
                              <>
                                <span className="brainstorm-rooms__flag">
                                  {room.status === 'running'
                                    ? t('tabs.brainstormsChipRound', { round: done })
                                    : t(statusLabelKey(room.status))}
                                </span>
                                <span className="brainstorm-rooms__sep">·</span>
                              </>
                            )}
                            <span>
                              {t('tabs.brainstormRoundValue', { current: done, max: room.maxRounds })}
                              {' '}
                              {t('tabs.brainstormRoundLabel')}
                            </span>
                            <span className="brainstorm-rooms__sep">·</span>
                            <span className="brainstorm-rooms__agents">
                              {room.participantAgentIds.slice(0, MAX_MONOGRAMS).map(agentId => (
                                <span key={agentId}>{monogramOf(agentId)}</span>
                              ))}
                              {room.participantAgentIds.length > MAX_MONOGRAMS ? (
                                <span>{`+${room.participantAgentIds.length - MAX_MONOGRAMS}`}</span>
                              ) : null}
                            </span>
                          </span>
                        </div>
                        <div className="brainstorm-rooms__end">
                          {/* Aparecen al pasar por encima: en una lista larga,
                              cuatro botones por fila son ruido. */}
                          <div className="brainstorm-rooms__actions">
                            {closed ? (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => { void handleToContext(room) }}
                                >
                                  {flash === 'context'
                                    ? t('tabs.brainstormsToContextDone')
                                    : t('tabs.brainstormsToContext')}
                                </Button>
                                <Tooltip content={t('tabs.brainstormsExportMd')}>
                                  <Button
                                    variant="icon"
                                    size="sm"
                                    aria-label={t('tabs.brainstormsExportMd')}
                                    onClick={() => { void handleExportMd(room) }}
                                  >
                                    <Icon name={flash === 'export' ? 'check' : 'download'} size={14} />
                                  </Button>
                                </Tooltip>
                              </>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onOpenRoom(room)}
                              >
                                {primaryLabel(room.status)}
                              </Button>
                            )}
                          </div>
                          {age ? <span className="brainstorm-rooms__age">{age}</span> : null}
                          <Tooltip content={t('tabs.brainstormsMoreActions')}>
                            <Button
                              variant="icon"
                              size="sm"
                              aria-label={t('tabs.brainstormsMoreActions')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setMenuFor(current => (current?.room.id === room.id
                                  ? null
                                  : { room, right: rect.right, bottom: rect.bottom }))
                              }}
                            >
                              <Icon name={flash === 'path' ? 'check' : 'more'} size={15} />
                            </Button>
                          </Tooltip>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        </div>
      </BrainstormOverlay>
      {menuFor ? (
        <BrainstormRoomMenu
          anchor={{ right: menuFor.right, bottom: menuFor.bottom }}
          items={menuItems(menuFor.room)}
          onClose={() => setMenuFor(null)}
        />
      ) : null}
      <ConfirmTerminalModal
        open={pendingDelete != null}
        active={active}
        zIndex={860}
        message={t('tabs.brainstormsDeleteConfirmTitle', {
          topic: pendingDelete?.topic ?? '',
        })}
        detail={t('tabs.brainstormsDeleteConfirmBody')}
        onConfirm={() => { void confirmDelete() }}
        onCancel={() => setPendingDelete(null)}
      />
      <BrainstormEditRoomModal
        open={editingRoom != null}
        active={active}
        cwd={cwd}
        room={editingRoom}
        agents={agents}
        onClose={() => setEditingRoom(null)}
        onSaved={() => {
          setEditingRoom(null)
          void refresh({ silent: true })
        }}
      />
    </>
  )
}
