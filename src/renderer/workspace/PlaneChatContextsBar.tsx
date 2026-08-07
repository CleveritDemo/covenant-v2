import React, { useEffect, useRef, useState } from 'react'
import type { IconName } from '../components/ui/Icon'
import { Button, ContextCheckOption, Icon } from '../components/ui'
import { useT } from '@i18n/useT'
import type { TabContextKind } from '@shared/tabContext'
import { PlaneChatAutoImproveToggle } from './PlaneChatAutoImproveToggle'
import { PlaneChatContextsTrigger } from './PlaneChatContextsTrigger'
import { PlaneChatLoopButton } from './PlaneChatLoopButton'
import './PlaneChatComposer.css'

export interface PlaneChatContextOption {
  id: string
  name: string
  kind: TabContextKind
  kindLabel: string
  icon: IconName
  color: string
}

export interface PlaneChatContextsBarProps {
  contexts: PlaneChatContextOption[]
  selectedContextIds: string[]
  contextsEmptyHint: string
  autoImprove: boolean
  loopMode: boolean
  loopActive: boolean
  canClearConversation?: boolean
  onToggleContext: (contextId: string) => void
  onAutoImproveChange: (enabled: boolean) => void
  onToggleLoop: () => void
  onClearConversation?: () => void
}

/** Barra de contextos en una línea (arriba del chat, sobre el fade). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  contexts,
  selectedContextIds,
  contextsEmptyHint,
  autoImprove,
  loopMode,
  loopActive,
  canClearConversation = false,
  onToggleContext,
  onAutoImproveChange,
  onToggleLoop,
  onClearConversation,
}) => {
  const { t } = useT()
  const [contextsOpen, setContextsOpen] = useState(false)
  const contextsPickerRef = useRef<HTMLDivElement>(null)

  const selectedContexts = contexts.filter(context => selectedContextIds.includes(context.id))
  const projectContexts = contexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = contexts.filter(context => context.kind === 'agentResult')
  const contextsPickerLabel = selectedContexts.length === 0
    ? t('tabContexts.pickerNone')
    : selectedContexts.length === 1
      ? selectedContexts[0].name
      : t('tabContexts.pickerSelected', { n: selectedContexts.length })

  useEffect(() => {
    if (!contextsOpen) return
    const onPointerDown = (event: MouseEvent): void => {
      const root = contextsPickerRef.current
      if (!root || root.contains(event.target as Node)) return
      setContextsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [contextsOpen])

  const renderContextOption = (context: PlaneChatContextOption) => (
    <ContextCheckOption
      key={context.id}
      appearance="menu"
      name={context.name}
      kindLabel={context.kindLabel}
      checked={selectedContextIds.includes(context.id)}
      emphasize={context.kind === 'agentResult'}
      title={`${context.name} — ${context.kindLabel}`}
      onChange={() => onToggleContext(context.id)}
    />
  )

  return (
    <div
      className="plane-chat-composer__contexts"
      aria-label={t('tabContexts.composerSection')}
    >
      <div className="plane-chat-composer__contexts-stack">
        <div
          ref={contextsPickerRef}
          className={[
            'plane-chat-composer__contexts-picker',
            contextsOpen ? 'plane-chat-composer__contexts-picker--open' : '',
          ].filter(Boolean).join(' ')}
        >
          <PlaneChatContextsTrigger
            label={t('tabContexts.composerSection')}
            ariaLabel={t('tabContexts.pickerAria', { label: contextsPickerLabel })}
            count={selectedContexts.length}
            open={contextsOpen}
            disabled={contexts.length === 0}
            onClick={() => setContextsOpen(open => !open)}
          />
          {contextsOpen && (
            <div
              className="plane-chat-composer__contexts-menu"
              role="listbox"
              aria-multiselectable="true"
            >
              {projectContexts.length > 0 && (
                <div className="plane-chat-composer__contexts-group">
                  {agentResultContexts.length > 0 && (
                    <div className="plane-chat-composer__contexts-group-title">
                      {t('tabContexts.groupProject')}
                    </div>
                  )}
                  {projectContexts.map(renderContextOption)}
                </div>
              )}
              {agentResultContexts.length > 0 && (
                <div className="plane-chat-composer__contexts-group">
                  <div className="plane-chat-composer__contexts-group-title">
                    {t('tabContexts.groupAgentResults')}
                  </div>
                  {agentResultContexts.map(renderContextOption)}
                </div>
              )}
            </div>
          )}
        </div>

        <PlaneChatAutoImproveToggle
          checked={autoImprove}
          disabled={selectedContextIds.length === 0}
          label={t('tabContexts.autoImprove')}
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
          <Button
            variant="icon"
            size="sm"
            aria-label={t('agentPane.clearConversation')}
            disabled={!canClearConversation}
            onClick={onClearConversation}
          >
            <Icon name="trash" size={13} />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
