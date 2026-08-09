import React from 'react'
import { Button, Icon, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import { PlaneChatAutoImproveToggle } from './PlaneChatAutoImproveToggle'
import { PlaneChatLoopButton } from './PlaneChatLoopButton'
import './PlaneChatComposer.css'

export interface PlaneChatContextsBarProps {
  /** Cuántos contextos tiene el agente (habilita auto-improve). */
  assignedContextCount: number
  autoImprove: boolean
  loopMode: boolean
  loopActive: boolean
  canClearConversation?: boolean
  onAutoImproveChange: (enabled: boolean) => void
  onToggleLoop: () => void
  onClearConversation?: () => void
}

/** Controles encima del chat (auto-improve, loop, limpiar). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  assignedContextCount,
  autoImprove,
  loopMode,
  loopActive,
  canClearConversation = false,
  onAutoImproveChange,
  onToggleLoop,
  onClearConversation,
}) => {
  const { t } = useT()
  const hasContexts = assignedContextCount > 0

  return (
    <div
      className="plane-chat-composer__contexts"
      aria-label={t('tabContexts.composerSection')}
    >
      <div className="plane-chat-composer__contexts-stack">
        <PlaneChatAutoImproveToggle
          checked={autoImprove}
          disabled={!hasContexts}
          label={t('tabContexts.autoImprove')}
          hint={hasContexts
            ? t('tabContexts.autoImproveHint')
            : t('tabContexts.autoImproveNeedsContext')}
          onChange={onAutoImproveChange}
        />

        <PlaneChatLoopButton
          pressed={loopMode}
          active={loopActive}
          disabled={loopActive}
          label={t('agentPane.loopBar')}
          ariaLabel={t('agentPane.loopTitle')}
          onClick={onToggleLoop}
        />

        {onClearConversation ? (
          <>
            <div className="plane-chat-composer__bar-sep" aria-hidden="true" />
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
