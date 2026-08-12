import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainstormRoom, BrainstormStatus } from '@shared/brainstormRoom'
import {
  formatBrainstormClosing,
  parseBrainstormClosing,
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
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { Button, Icon, Input, Tooltip } from '../components/ui'
import { BrainstormEditRoomModal } from './BrainstormEditRoomModal'
import { BrainstormRoomMenu, type BrainstormRoomMenuItem } from './BrainstormRoomMenu'
import './BrainstormListModal.css'

export interface BrainstormListModalProps {
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
  const closing = last ? parseBrainstormClosing(last.text) : null
  return closing ? formatBrainstormClosing(room.topic, closing) : buildBrainstormMarkdown(room)
}

const FEEDBACK_MS = 1500
const LIVE_REFRESH_MS = 2000
const PRUNE_FEEDBACK_MS = 2500
/** Monogramas visibles antes de resumir en «+N». */
const MAX_MONOGRAMS = 4

/** Lista salas persistidas: una acción primaria por estado y el resto detrás del `⋯`. */
export const BrainstormListModal: React.FC<BrainstormListModalProps> = ({
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

  const groups = useMemo(
    () => groupBrainstormRooms(filterBrainstormRooms(rooms, query), now),
    [rooms, query, now],
  )

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

  return (
    <>
      <TerminalModal
        open={open}
        active={active}
        onClose={onClose}
        title={(
          <span className="brainstorm-list-modal__title">
            {t('tabs.brainstormsListTitle')}
            {rooms.length > 0 ? (
              <span className="brainstorm-list-modal__count">
                {t('tabs.brainstormsCount', { count: rooms.length })}
              </span>
            ) : null}
          </span>
        )}
        size="md"
        zIndex={840}
        footer={(
          <div className="brainstorm-list-modal__footer">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void handlePrune() }}
              disabled={!cwd.trim()}
            >
              {t('tabs.brainstormsPruneOld')}
            </Button>
            <div className="brainstorm-list-modal__footer-end">
              <Button variant="secondary" size="sm" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose()
                  onCreate()
                }}
              >
                {t('tabs.brainstormsCreateNew')}
              </Button>
            </div>
          </div>
        )}
      >
        {rooms.length > 0 ? (
          <div className="brainstorm-list-modal__search">
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
        {pruneFeedback ? (
          <p className="brainstorm-list-modal__feedback">{pruneFeedback}</p>
        ) : null}
        {loading ? (
          <p className="brainstorm-list-modal__hint">{t('tabs.brainstormsListLoading')}</p>
        ) : rooms.length === 0 ? (
          <div className="brainstorm-list-modal__empty">
            <Icon name="messages" size={30} aria-hidden />
            <h3 className="brainstorm-list-modal__empty-title">{t('tabs.brainstormsListEmpty')}</h3>
            {/* El CTA vive solo en el footer: repetirlo aquí duplicaba el botón. */}
            <p className="brainstorm-list-modal__empty-body">{t('tabs.brainstormsEmptyBody')}</p>
          </div>
        ) : groups.length === 0 ? (
          <p className="brainstorm-list-modal__hint">{t('tabs.brainstormsFilterEmpty')}</p>
        ) : (
          <div className="brainstorm-list-modal__groups">
            {groups.map(group => (
              <section key={group.key} className="brainstorm-list-modal__group">
                <h3 className="brainstorm-list-modal__group-title">
                  {t(groupLabelKey(group.key))}
                </h3>
                <ul className="brainstorm-list-modal__list">
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
                          'brainstorm-list-modal__item',
                          `brainstorm-list-modal__item--${tone}`,
                          group.key === 'older' ? 'brainstorm-list-modal__item--faded' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="brainstorm-list-modal__meta">
                          <span className="brainstorm-list-modal__topic">{room.topic}</span>
                          <span className="brainstorm-list-modal__facts">
                            <span className={`brainstorm-list-modal__chip brainstorm-list-modal__chip--${tone}`}>
                              <i />
                              {room.status === 'running'
                                ? t('tabs.brainstormsChipRound', { round: done })
                                : t(statusLabelKey(room.status))}
                            </span>
                            <span className="brainstorm-list-modal__rounds">
                              <span className="brainstorm-list-modal__pips">
                                {Array.from({ length: room.maxRounds }, (_, index) => (
                                  <s
                                    key={index}
                                    className={index < done
                                      ? 'brainstorm-list-modal__pip brainstorm-list-modal__pip--on'
                                      : 'brainstorm-list-modal__pip'}
                                  />
                                ))}
                              </span>
                              <b>{t('tabs.brainstormRoundValue', { current: done, max: room.maxRounds })}</b>
                            </span>
                            <span className="brainstorm-list-modal__sep">·</span>
                            <span className="brainstorm-list-modal__agents">
                              {room.participantAgentIds.slice(0, MAX_MONOGRAMS).map(agentId => (
                                <span key={agentId}>{monogramOf(agentId)}</span>
                              ))}
                              {room.participantAgentIds.length > MAX_MONOGRAMS ? (
                                <span>{`+${room.participantAgentIds.length - MAX_MONOGRAMS}`}</span>
                              ) : null}
                            </span>
                            {age ? (
                              <>
                                <span className="brainstorm-list-modal__sep">·</span>
                                <span>{age}</span>
                              </>
                            ) : null}
                          </span>
                        </div>
                        <div className="brainstorm-list-modal__actions">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onOpenRoom(room)
                              onClose()
                            }}
                          >
                            {primaryLabel(room.status)}
                          </Button>
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
                          ) : null}
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
      </TerminalModal>
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
