import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { Button, Icon, Input, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import { barChipThreads, threadDisplayTitleOr, threadTitleHasVisibleText, truncateThreadChipLabel, type AgentThread } from '@shared/agentThreads'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import { resolveThreadChipActivityDot } from '../agent/paneWorkActive'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import { PlaneChatThreadHistoryButton } from './PlaneChatThreadHistoryButton'
import { animateThreadChipReorder } from './threadChipReorder'
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
  /** Ola del orquestador: filas en el popover de historial. */
  orchestrationAwaiting?: OrchestrationAwaitingView | null
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

/** Título visible en chip: delegación usa i18n fijo, no actividad ni `threadUntitled`. */
function threadChipTitle(
  thread: AgentThread,
  t: (key: string) => string,
): string {
  if (thread.origin === 'delegation') {
    return t('agentPane.threadDelegationTitle')
  }
  return threadDisplayTitleOr(thread.title, t('agentPane.threadUntitled'))
}

function threadChipShowsPlaceholder(
  thread: AgentThread,
): boolean {
  if (thread.origin === 'delegation') return false
  return !threadTitleHasVisibleText(thread.title.trim())
}

function threadChipLabelText(title: string): string {
  return truncateThreadChipLabel(title)
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
  orchestrationAwaiting = null,
  threadSelectionLocked = false,
  newThreadLocked = false,
  onClearConversation,
  onSelectThread,
  onNewThread,
  onRenameThread,
}) => {
  const { t } = useT()
  const showThreads = threads.length > 0 && Boolean(onSelectThread)
  const chipThreads = barChipThreads(threads, activeThreadId, runningThreadIds)
  const chipOrderKey = chipThreads.map(thread => thread.id).join('\0')
  const threadPanelId = `thread-history-panel-${useId().replace(/:/g, '')}`
  const threadHistoryTriggerRef = useRef<HTMLSpanElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const chipLeftByIdRef = useRef<Map<string, number>>(new Map())
  const [threadPanelOpen, setThreadPanelOpen] = useState(false)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  useLayoutEffect(() => {
    const root = chipsRef.current
    if (!root) return
    chipLeftByIdRef.current = animateThreadChipReorder(
      root,
      chipLeftByIdRef.current,
    )
  }, [chipOrderKey])

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

  const renderActiveChip = (thread: AgentThread): React.ReactNode => {
    const title = threadChipTitle(thread, t)
    const chipDot = resolveThreadChipActivityDot(
      thread.id,
      activeThreadId,
      awaitingDelegations,
      runningThreadIds,
      paneCliBusy,
      awaitingDelegationThreadIds,
    )

    if (editingThreadId === thread.id) {
      return (
        <div
          key={thread.id}
          data-thread-chip-id={thread.id}
          className="plane-chat-contexts-bar__chip plane-chat-contexts-bar__chip--editing"
          role="presentation"
        >
          <Input
            size="sm"
            autoFocus
            value={draftTitle}
            aria-label={t('agentPane.threadRename')}
            placeholder={t('agentPane.threadUntitled')}
            onFocus={event => event.currentTarget.select()}
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
      )
    }

    const label = threadChipLabelText(title)

    const activeChip = (
      <span
        className="plane-chat-contexts-bar__chip plane-chat-contexts-bar__chip--active"
        role="option"
        aria-selected={true}
        aria-current="true"
        aria-label={title}
      >
        {chipDot ? (
          <PlaneBusyDot size="sm" variant={chipDot} />
        ) : null}
        <span
          className={[
            'plane-chat-contexts-bar__chip-label',
            threadChipShowsPlaceholder(thread)
              ? 'plane-chat-contexts-bar__chip-label--placeholder'
              : '',
          ].filter(Boolean).join(' ')}
        >
          {label}
        </span>
      </span>
    )

    return (
      <div
        key={thread.id}
        data-thread-chip-id={thread.id}
        className="plane-chat-contexts-bar__chip-host plane-chat-contexts-bar__chip-host--active"
      >
        {label !== title ? (
          <Tooltip content={title} hint={title}>
            {activeChip}
          </Tooltip>
        ) : (
          activeChip
        )}
        {onRenameThread ? (
          <button
            type="button"
            className="plane-chat-contexts-bar__chip-edit"
            aria-label={t('agentPane.threadRename')}
            onClick={event => {
              event.stopPropagation()
              startRename(thread)
            }}
          >
            <Icon name="pencil" size={12} />
          </button>
        ) : null}
      </div>
    )
  }

  const renderRecentChip = (thread: AgentThread): React.ReactNode => {
    const title = threadChipTitle(thread, t)
    const isRunning = runningThreadIds.includes(thread.id)
    const chipDot = isRunning
      ? resolveThreadChipActivityDot(
        thread.id,
        activeThreadId,
        awaitingDelegations,
        runningThreadIds,
        paneCliBusy,
        awaitingDelegationThreadIds,
      )
      : null
    const activity = runningThreadActivities[thread.id]?.trim()
      || (chipDot === 'delegating'
        ? t('agentPane.delegatingTitle')
        : t('agentPane.awaitingStatusRunning'))
    const hint = isRunning
      ? (threadSelectionLocked
        ? activity
        : `${activity} · ${t('agentPane.threadBackgroundDotHint')}`)
      : title

    return (
      <span
        key={thread.id}
        data-thread-chip-id={thread.id}
        className="plane-chat-contexts-bar__chip-flip"
      >
        <Tooltip content={title} hint={hint}>
          <button
            type="button"
            role="option"
            className={[
              'plane-chat-contexts-bar__chip',
              'plane-chat-contexts-bar__chip--recent',
              isRunning ? 'plane-chat-contexts-bar__chip--running' : '',
            ].filter(Boolean).join(' ')}
            disabled={threadSelectionLocked}
            aria-label={title}
            aria-selected={false}
            onClick={() => onSelectThread!(thread.id)}
          >
            {chipDot ? (
              <PlaneBusyDot size="sm" variant={chipDot} />
            ) : null}
            <span
              className={[
                'plane-chat-contexts-bar__chip-label',
                threadChipShowsPlaceholder(thread)
                  ? 'plane-chat-contexts-bar__chip-label--placeholder'
                  : '',
              ].filter(Boolean).join(' ')}
            >
              {threadChipLabelText(title)}
            </span>
          </button>
        </Tooltip>
      </span>
    )
  }

  return (
    <div
      className="plane-chat-composer__contexts"
      aria-label={t('tabContexts.composerSection')}
    >
      <div className="plane-chat-contexts-bar__stack">
        {chipThreads.length > 0 ? (
          <div className="plane-chat-contexts-bar__chips-scroll">
            {showThreads ? (
              <div
                ref={chipsRef}
                className="plane-chat-contexts-bar__chips"
                role="presentation"
              >
                {chipThreads.map(thread => (
                  thread.id === activeThreadId
                    ? renderActiveChip(thread)
                    : renderRecentChip(thread)
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showThreads || onNewThread || onClearConversation ? (
          <div className="plane-chat-contexts-bar__actions">
            {showThreads ? (
              <PlaneChatThreadHistoryButton
                panelId={threadPanelId}
                triggerRef={threadHistoryTriggerRef}
                panelAlign="trigger-center"
                threads={threads}
                activeThreadId={activeThreadId}
                runningThreadIds={runningThreadIds}
                awaitingDelegations={awaitingDelegations}
                awaitingDelegationThreadIds={awaitingDelegationThreadIds}
                orchestrationAwaiting={orchestrationAwaiting}
                runningThreadActivities={runningThreadActivities}
                paneCliBusy={paneCliBusy}
                threadSelectionLocked={threadSelectionLocked}
                onSelectThread={onSelectThread!}
                onOpenChange={setThreadPanelOpen}
                anchor={hoverProps => (
                  <Tooltip
                    content={t('agentPane.threadHistory')}
                    hint={t('agentPane.threadHistoryHint')}
                  >
                    <span
                      ref={threadHistoryTriggerRef}
                      className="plane-chat-contexts-bar__history-host"
                      {...hoverProps}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('agentPane.threadHistoryAria')}
                        aria-expanded={threadPanelOpen}
                      >
                        <Icon name="history" size={13} />
                      </Button>
                    </span>
                  </Tooltip>
                )}
              />
            ) : null}
            {onNewThread ? (
              <Tooltip content={t('agentPane.threadNew')} hint={t('agentPane.threadNewHint')}>
                <Button
                  variant="ghost"
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
                  variant="ghost"
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
