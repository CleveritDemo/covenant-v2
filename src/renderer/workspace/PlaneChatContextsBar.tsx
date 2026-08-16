import React, { useId, useRef, useState } from 'react'
import { Button, Icon, Input, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import type { AgentThread } from '@shared/agentThreads'
import { resolveThreadChipActivityDot } from '../agent/paneWorkActive'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import { PlaneChatBackgroundThreadDots } from './PlaneChatBackgroundThreadDots'
import { PlaneChatThreadHistoryButton } from './PlaneChatThreadHistoryButton'
import './PlaneChatComposer.css'
import './PlaneChatContextsBar.css'

export interface PlaneChatContextsBarProps {
  canClearConversation?: boolean
  /** Conversaciones del agente abierto; vacío oculta el selector. */
  threads?: readonly AgentThread[]
  activeThreadId?: string
  /** Hilos con turno activo: marcan la opción con punto luminoso en el panel. */
  runningThreadIds?: readonly string[]
  /** Petición del usuario por hilo en curso (tooltip de dots de fondo). */
  runningThreadActivities?: Readonly<Record<string, string>>
  /** Orquestador esperando especialistas: dot delegating en el chip activo. */
  awaitingDelegations?: boolean
  /** Hilos con ola abierta; si está presente, delegating solo en estos chips. */
  awaitingDelegationThreadIds?: readonly string[]
  /** Turno CLI vivo: oculta delegating hasta que el pane quede idle. */
  paneCliBusy?: boolean
  /**
   * Cambiar de conversación con un loop vivo dejaría el stream escribiendo en
   * el transcript equivocado, así que se bloquea el Select.
   */
  threadSelectionLocked?: boolean
  /**
   * Bloquea el botón "+" para pedir una conversación nueva. Solo se lockea si
   * ya hay una petición pendiente o el loop está activo; con un turno normal
   * se permite pedirla y aplicarla en diferido al cerrar el turno.
   */
  newThreadLocked?: boolean
  onClearConversation?: () => void
  onSelectThread?: (threadId: string) => void
  onNewThread?: () => void
  /** Retitula la conversación activa; sin esto no se muestra el lápiz. */
  onRenameThread?: (title: string) => void
}

/** Controles encima del chat (conversaciones). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  canClearConversation = false,
  threads = [],
  activeThreadId = '',
  runningThreadIds = [],
  runningThreadActivities = {},
  awaitingDelegations = false,
  awaitingDelegationThreadIds,
  paneCliBusy = false,
  threadSelectionLocked = false,
  newThreadLocked = false,
  onClearConversation,
  onSelectThread,
  onNewThread,
  onRenameThread,
}) => {
  const { t } = useT()
  const showThreads = threads.length > 0 && Boolean(onSelectThread)
  const activeThread = threads.find(thread => thread.id === activeThreadId)
  const activeChipDot = activeThread
    ? resolveThreadChipActivityDot(
      activeThread.id,
      activeThreadId,
      awaitingDelegations,
      runningThreadIds,
      paneCliBusy,
      awaitingDelegationThreadIds,
    )
    : null
  const threadTitleById = new Map(threads.map(thread => [thread.id, thread.title]))
  const backgroundDots = runningThreadIds
    .filter(threadId => threadId !== activeThreadId)
    .map(threadId => ({
      threadId,
      variant: resolveThreadChipActivityDot(
        threadId,
        activeThreadId,
        awaitingDelegations,
        runningThreadIds,
        paneCliBusy,
        awaitingDelegationThreadIds,
      ) ?? 'busy',
      title: threadTitleById.get(threadId) ?? '',
      activity: runningThreadActivities[threadId] ?? '',
    }))
  const threadPanelId = `thread-history-panel-${useId().replace(/:/g, '')}`
  const threadChipRef = useRef<HTMLSpanElement>(null)
  const [threadPanelOpen, setThreadPanelOpen] = useState(false)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const commitRename = (): void => {
    if (editingThreadId === null) return
    onRenameThread?.(draftTitle)
    setEditingThreadId(null)
    setDraftTitle('')
  }

  const startRename = (thread: AgentThread): void => {
    setEditingThreadId(thread.id)
    setDraftTitle(thread.title || '')
  }

  return (
    <div
      className="plane-chat-composer__contexts"
      aria-label={t('tabContexts.composerSection')}
    >
      <div className="plane-chat-contexts-bar__stack">
        {(backgroundDots.length > 0 && onSelectThread) || (showThreads && activeThread) ? (
          <div className="plane-chat-contexts-bar__center">
            {backgroundDots.length > 0 && onSelectThread ? (
              <PlaneChatBackgroundThreadDots
                dots={backgroundDots}
                selectionLocked={threadSelectionLocked}
                onSelectThread={onSelectThread}
              />
            ) : null}
            {showThreads && activeThread ? (
              <div
                className="plane-chat-contexts-bar__chips"
                role="presentation"
              >
            {editingThreadId === activeThread.id ? (
              <div
                className="plane-chat-contexts-bar__chip plane-chat-contexts-bar__chip--editing"
                role="presentation"
              >
                <Input
                  size="sm"
                  autoFocus
                  value={draftTitle}
                  aria-label={t('agentPane.threadRename')}
                  placeholder={t('agentPane.threadUntitled')}
                  onChange={event => setDraftTitle(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commitRename()
                    if (event.key === 'Escape') {
                      setEditingThreadId(null)
                      setDraftTitle('')
                    }
                  }}
                />
              </div>
            ) : (
              <div className="plane-chat-contexts-bar__thread-dropdown">
                <PlaneChatThreadHistoryButton
                  panelId={threadPanelId}
                  triggerRef={threadChipRef}
                  threads={threads}
                  activeThreadId={activeThreadId}
                  runningThreadIds={runningThreadIds}
                  awaitingDelegations={awaitingDelegations}
                  awaitingDelegationThreadIds={awaitingDelegationThreadIds}
                  paneCliBusy={paneCliBusy}
                  threadSelectionLocked={threadSelectionLocked}
                  onSelectThread={onSelectThread!}
                  onOpenChange={setThreadPanelOpen}
                  anchor={hoverProps => (
                <div
                  ref={threadChipRef}
                  className="plane-chat-contexts-bar__chip-host"
                  {...hoverProps}
                >
                  <span
                    className={[
                      'plane-chat-contexts-bar__chip',
                      'plane-chat-contexts-bar__chip--active',
                      threadPanelOpen ? 'plane-chat-contexts-bar__chip--menu-open' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={activeThread.title || t('agentPane.threadUntitled')}
                  >
                    {activeChipDot ? (
                      <PlaneBusyDot size="sm" variant={activeChipDot} />
                    ) : null}
                    <span className="plane-chat-contexts-bar__chip-label">
                      {activeThread.title || t('agentPane.threadUntitled')}
                    </span>
                  </span>
                  {onRenameThread ? (
                    <button
                      type="button"
                      className="plane-chat-contexts-bar__chip-edit"
                      aria-label={t('agentPane.threadRename')}
                      onClick={event => {
                        event.stopPropagation()
                        startRename(activeThread)
                      }}
                    >
                      <Icon name="pencil" size={12} />
                    </button>
                  ) : null}
                </div>
                  )}
                />
              </div>
            )}
              </div>
            ) : null}
          </div>
        ) : null}

        {onNewThread || onClearConversation ? (
          <div className="plane-chat-contexts-bar__actions">
            {onNewThread ? (
              <Tooltip content={t('agentPane.threadNew')} hint={t('agentPane.threadNewHint')}>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={t('agentPane.threadNew')}
                  disabled={newThreadLocked}
                  onClick={onNewThread}
                >
                  <Icon name="plus" size={13} />
                </Button>
              </Tooltip>
            ) : null}
            {onClearConversation ? (
              <Tooltip content={t('agentPane.clearConversation')}>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={t('agentPane.clearConversation')}
                  disabled={!canClearConversation}
                  onClick={onClearConversation}
                >
                  <Icon name="trash" size={13} />
                </Button>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
