import React, { useMemo, useState } from 'react'
import { Button, Icon, Input, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import { sortThreadsByRecency, type AgentThread } from '@shared/agentThreads'
import { PlaneBusyDot } from './PlaneBusyDot'
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

/** Hilos visibles en la barra: conversación activa + las que están corriendo. */
function visibleThreads(
  threads: readonly AgentThread[],
  activeThreadId: string,
  runningThreadIds: readonly string[],
): AgentThread[] {
  const ids = new Set<string>()
  if (activeThreadId) ids.add(activeThreadId)
  for (const id of runningThreadIds) ids.add(id)
  return sortThreadsByRecency(threads.filter(thread => ids.has(thread.id)))
}

/** Controles encima del chat (conversaciones). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  canClearConversation = false,
  threads = [],
  activeThreadId = '',
  runningThreadIds = [],
  threadSelectionLocked = false,
  newThreadLocked = false,
  onClearConversation,
  onSelectThread,
  onNewThread,
  onRenameThread,
}) => {
  const { t } = useT()
  const showThreads = threads.length > 0 && Boolean(onSelectThread)
  const chips = useMemo(
    () => visibleThreads(threads, activeThreadId, runningThreadIds),
    [threads, activeThreadId, runningThreadIds],
  )
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
        {showThreads ? (
          <div
            className="plane-chat-contexts-bar__chips"
            role="tablist"
            aria-label={t('agentPane.threadsLabel')}
          >
            {chips.map(thread => {
              const isActive = thread.id === activeThreadId
              const isRunning = runningThreadIds.includes(thread.id)
              const isEditing = editingThreadId === thread.id
              const title = thread.title || t('agentPane.threadUntitled')
              const switchDisabled = threadSelectionLocked && !isActive

              if (isEditing) {
                return (
                  <div
                    key={thread.id}
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
                )
              }

              return (
                <div
                  key={thread.id}
                  className={[
                    'plane-chat-contexts-bar__chip',
                    isActive ? 'plane-chat-contexts-bar__chip--active' : '',
                  ].filter(Boolean).join(' ')}
                  role="presentation"
                >
                  <button
                    type="button"
                    role="tab"
                    className="plane-chat-contexts-bar__chip-tab"
                    aria-selected={isActive}
                    aria-label={title}
                    disabled={switchDisabled}
                    onClick={() => {
                      if (!isActive) onSelectThread?.(thread.id)
                    }}
                  >
                    {isRunning ? <PlaneBusyDot size="sm" /> : null}
                    <span className="plane-chat-contexts-bar__chip-label">{title}</span>
                  </button>
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
            })}
          </div>
        ) : null}

        {onNewThread || onClearConversation || showThreads ? (
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
            {showThreads && onSelectThread ? (
              <PlaneChatThreadHistoryButton
                threads={threads}
                activeThreadId={activeThreadId}
                runningThreadIds={runningThreadIds}
                threadSelectionLocked={threadSelectionLocked}
                onSelectThread={onSelectThread}
              />
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
