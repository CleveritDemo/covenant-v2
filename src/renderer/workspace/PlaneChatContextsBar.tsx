import React, { useState } from 'react'
import { Button, Icon, Input, Select, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import { sortThreadsByRecency, type AgentThread } from '@shared/agentThreads'
import { PlaneChatLoopButton } from './PlaneChatLoopButton'
import './PlaneChatComposer.css'

export interface PlaneChatContextsBarProps {
  loopMode: boolean
  loopActive: boolean
  canClearConversation?: boolean
  /** Conversaciones del agente abierto; vacío oculta el selector. */
  threads?: readonly AgentThread[]
  activeThreadId?: string
  /**
   * Cambiar de conversación con un turno o loop vivo dejaría el stream
   * escribiendo en el transcript equivocado, así que se bloquea el Select.
   */
  threadSelectionLocked?: boolean
  /**
   * Bloquea el botón "+" para pedir una conversación nueva. Solo se lockea si
   * ya hay una petición pendiente o el loop está activo; con un turno normal
   * se permite pedirla y aplicarla en diferido al cerrar el turno.
   */
  newThreadLocked?: boolean
  onToggleLoop: () => void
  onClearConversation?: () => void
  onSelectThread?: (threadId: string) => void
  onNewThread?: () => void
  /** Retitula la conversación activa; sin esto no se muestra el lápiz. */
  onRenameThread?: (title: string) => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Controles encima del chat (loop y conversaciones). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  loopMode,
  loopActive,
  canClearConversation = false,
  threads = [],
  activeThreadId = '',
  threadSelectionLocked = false,
  newThreadLocked = false,
  onToggleLoop,
  onClearConversation,
  onSelectThread,
  onNewThread,
  onRenameThread,
}) => {
  const { t } = useT()
  const showThreads = threads.length > 0 && Boolean(onSelectThread)
  /** `null` = no se está renombrando; el selector ocupa su lugar. */
  const [draftTitle, setDraftTitle] = useState<string | null>(null)
  const activeThread = threads.find(thread => thread.id === activeThreadId)

  const commitRename = (): void => {
    if (draftTitle !== null) onRenameThread?.(draftTitle)
    setDraftTitle(null)
  }

  return (
    <div
      className="plane-chat-composer__contexts"
      aria-label={t('tabContexts.composerSection')}
    >
      <div className="plane-chat-composer__contexts-stack">
        <PlaneChatLoopButton
          pressed={loopMode}
          active={loopActive}
          disabled={loopActive}
          label={t('agentPane.loopBar')}
          ariaLabel={t('agentPane.loopTitle')}
          onClick={onToggleLoop}
        />

        {showThreads ? (
          <>
            <div className="plane-chat-composer__bar-sep" aria-hidden="true" />
            {/* El Input del kit ocupa el 100%; el Select en ghost se auto-ajusta. */}
            <div className="plane-chat-composer__threads">
              {draftTitle === null ? (
                <Select
                  size="sm"
                  variant="ghost"
                  value={activeThreadId}
                  disabled={threadSelectionLocked}
                  aria-label={t('agentPane.threadsLabel')}
                  options={sortThreadsByRecency(threads).map(thread => ({
                    value: thread.id,
                    label: thread.title || t('agentPane.threadUntitled'),
                    ...(thread.updatedAt ? { hint: dateFormat.format(thread.updatedAt) } : {}),
                  }))}
                  onChange={threadId => onSelectThread?.(threadId)}
                />
              ) : (
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
                    if (event.key === 'Escape') setDraftTitle(null)
                  }}
                />
              )}
            </div>
            {onRenameThread ? (
              <Tooltip content={t('agentPane.threadRename')}>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={t('agentPane.threadRename')}
                  // Solo abre: el blur del input ya cierra y guarda, así que un
                  // toggle aquí se pelearía con él y reabriría al instante.
                  disabled={draftTitle !== null}
                  onClick={() => setDraftTitle(activeThread?.title ?? '')}
                >
                  <Icon name="pencil" size={13} />
                </Button>
              </Tooltip>
            ) : null}
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
          </>
        ) : null}

        {onClearConversation ? (
          <>
            {showThreads ? null : (
              <div className="plane-chat-composer__bar-sep" aria-hidden="true" />
            )}
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
          </>
        ) : null}
      </div>
    </div>
  )
}
