import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { BrainstormRoom, BrainstormStatus } from '@shared/brainstormRoom'
import { BRAINSTORM_DIR, brainstormFileName } from '@shared/brainstormCatalog'
import { PROJECT_DIR } from '@shared/projectDir'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { Button } from '../components/ui'
import { BrainstormEditRoomModal } from './BrainstormEditRoomModal'
import './BrainstormListModal.css'

export interface BrainstormListModalProps {
  open: boolean
  active?: boolean
  cwd: string
  onClose: () => void
  onCreate: () => void
  onOpenRoom: (room: BrainstormRoom) => void
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

const COPY_FEEDBACK_MS = 1500
const LIVE_REFRESH_MS = 2000
const PRUNE_FEEDBACK_MS = 2500

/** Lista salas persistidas: abrir, eliminar, crear nuevo. */
export const BrainstormListModal: React.FC<BrainstormListModalProps> = ({
  open,
  active = true,
  cwd,
  onClose,
  onCreate,
  onOpenRoom,
}) => {
  const { t } = useT()
  const [rooms, setRooms] = useState<BrainstormRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BrainstormRoom | null>(null)
  const [editingRoom, setEditingRoom] = useState<BrainstormRoom | null>(null)
  const [copiedById, setCopiedById] = useState<Record<string, boolean>>({})
  const [exportedById, setExportedById] = useState<Record<string, boolean>>({})
  const [pruneFeedback, setPruneFeedback] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const copyTimersRef = useRef<Map<string, number>>(new Map())
  const exportTimersRef = useRef<Map<string, number>>(new Map())
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
    } catch {
      setRooms([])
    } finally {
      loadingRef.current = false
      if (!opts?.silent) setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    if (!open) return
    void refresh()
    const timer = window.setInterval(() => {
      void refresh({ silent: true })
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [open, refresh])

  useEffect(() => () => {
    for (const timer of copyTimersRef.current.values()) {
      window.clearTimeout(timer)
    }
    copyTimersRef.current.clear()
    for (const timer of exportTimersRef.current.values()) {
      window.clearTimeout(timer)
    }
    exportTimersRef.current.clear()
    if (pruneTimerRef.current != null) window.clearTimeout(pruneTimerRef.current)
  }, [])

  const handleCopyPath = useCallback((room: BrainstormRoom): void => {
    const root = cwd.trim()
    if (!root) return
    // ponytail: asume `.gravity`; un proyecto aún en `.iaterminal` copia la ruta nueva.
    // Arreglar exponiendo la carpeta resuelta por IPC si alguien se queja.
    const path = `${root}/${PROJECT_DIR}/${BRAINSTORM_DIR}/${brainstormFileName(room.id)}`
    void navigator.clipboard.writeText(path).then(() => {
      setCopiedById(prev => ({ ...prev, [room.id]: true }))
      const prevTimer = copyTimersRef.current.get(room.id)
      if (prevTimer != null) window.clearTimeout(prevTimer)
      const timer = window.setTimeout(() => {
        setCopiedById(prev => {
          const next = { ...prev }
          delete next[room.id]
          return next
        })
        copyTimersRef.current.delete(room.id)
      }, COPY_FEEDBACK_MS)
      copyTimersRef.current.set(room.id, timer)
    }).catch(() => {})
  }, [cwd])

  const handleExportMd = useCallback(async (room: BrainstormRoom): Promise<void> => {
    const root = cwd.trim()
    if (!root) return
    try {
      const result = await window.api.exportBrainstormMarkdown(root, room.id)
      if (!result.ok) return
      setExportedById(prev => ({ ...prev, [room.id]: true }))
      const prevTimer = exportTimersRef.current.get(room.id)
      if (prevTimer != null) window.clearTimeout(prevTimer)
      const timer = window.setTimeout(() => {
        setExportedById(prev => {
          const next = { ...prev }
          delete next[room.id]
          return next
        })
        exportTimersRef.current.delete(room.id)
      }, COPY_FEEDBACK_MS)
      exportTimersRef.current.set(room.id, timer)
    } catch {
      /* ignore export failures */
    }
  }, [cwd])
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

  return (
    <>
      <TerminalModal
        open={open}
        active={active}
        onClose={onClose}
        title={t('tabs.brainstormsListTitle')}
        size="md"
        zIndex={840}
        footer={(
          <div className="brainstorm-list-modal__footer">
            <Button
              variant="secondary"
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
        <p className="brainstorm-list-modal__hint">{t('tabs.brainstormsListHint')}</p>
        {pruneFeedback ? (
          <p className="brainstorm-list-modal__feedback">{pruneFeedback}</p>
        ) : null}
        {loading ? (
          <p className="brainstorm-list-modal__hint">{t('tabs.brainstormsListLoading')}</p>
        ) : rooms.length === 0 ? (
          <p className="brainstorm-list-modal__hint">{t('tabs.brainstormsListEmpty')}</p>
        ) : (
          <ul className="brainstorm-list-modal__list">
            {rooms.map(room => (
              <li key={room.id} className="brainstorm-list-modal__item">
                <div className="brainstorm-list-modal__meta">
                  <span className="brainstorm-list-modal__topic">{room.topic}</span>
                  <span className="brainstorm-list-modal__sub">
                    {t(statusLabelKey(room.status))}
                    {' · '}
                    {t('tabs.brainstormRoundValue', {
                      current: Math.min(room.round + (room.status === 'running' ? 1 : 0) || 1, room.maxRounds),
                      max: room.maxRounds,
                    })}
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
                    {t('tabs.brainstormsOpen')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={room.status === 'running'}
                    title={room.status === 'running'
                      ? t('tabs.brainstormsEditDisabledHint')
                      : undefined}
                    onClick={() => {
                      if (room.status === 'running') return
                      setEditingRoom(room)
                    }}
                  >
                    {t('tabs.brainstormsEdit')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyPath(room)}
                  >
                    {copiedById[room.id]
                      ? t('tabs.brainstormsCopyPathDone')
                      : t('tabs.brainstormsCopyPath')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { void handleExportMd(room) }}
                  >
                    {exportedById[room.id]
                      ? t('tabs.brainstormsExportMdDone')
                      : t('tabs.brainstormsExportMd')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDelete(room)}
                  >
                    {t('tabs.brainstormsDelete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TerminalModal>
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
        onClose={() => setEditingRoom(null)}
        onSaved={() => {
          setEditingRoom(null)
          void refresh({ silent: true })
        }}
      />
    </>
  )
}
