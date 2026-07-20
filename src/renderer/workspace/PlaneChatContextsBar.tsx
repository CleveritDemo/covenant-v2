import React, { useEffect, useRef, useState } from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { useT } from '@i18n/useT'
import type { TabContextKind } from '@shared/tabContext'
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
  onToggleContext: (contextId: string) => void
  onAutoImproveChange: (enabled: boolean) => void
  onToggleLoop: () => void
}

/** Barra de contextos en una línea (arriba del chat, sobre el fade). */
export const PlaneChatContextsBar: React.FC<PlaneChatContextsBarProps> = ({
  contexts,
  selectedContextIds,
  contextsEmptyHint,
  autoImprove,
  loopMode,
  loopActive,
  onToggleContext,
  onAutoImproveChange,
  onToggleLoop,
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

  const renderContextOption = (context: PlaneChatContextOption) => {
    const checked = selectedContextIds.includes(context.id)
    const isAgentResult = context.kind === 'agentResult'
    return (
      <label
        key={context.id}
        className={[
          'plane-chat-composer__contexts-option',
          checked ? 'plane-chat-composer__contexts-option--on' : '',
          isAgentResult ? 'plane-chat-composer__contexts-option--agent-result' : '',
        ].filter(Boolean).join(' ')}
        title={`${context.name} — ${context.kindLabel}`}
      >
        <input
          type="checkbox"
          role="option"
          aria-selected={checked}
          checked={checked}
          onChange={() => onToggleContext(context.id)}
        />
        <span className="plane-chat-composer__contexts-check" aria-hidden="true" />
        <span className="plane-chat-composer__contexts-option-name">{context.name}</span>
        <span className="plane-chat-composer__contexts-option-kind">{context.kindLabel}</span>
      </label>
    )
  }

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
          <button
            type="button"
            className="plane-chat-composer__contexts-trigger"
            aria-haspopup="listbox"
            aria-expanded={contextsOpen}
            aria-label={t('tabContexts.pickerAria', { label: contextsPickerLabel })}
            disabled={contexts.length === 0}
            title={contexts.length === 0 ? contextsEmptyHint : contextsPickerLabel}
            onClick={() => setContextsOpen(open => !open)}
          >
            <Icon name="files" size={13} />
            <span className="plane-chat-composer__contexts-label">
              {t('tabContexts.composerSection')}
            </span>
            {selectedContexts.length > 0 && (
              <span className="plane-chat-composer__contexts-count" aria-hidden="true">
                {selectedContexts.length}
              </span>
            )}
            <Icon name="chevron-down" size={11} />
          </button>
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

        <label
          className="plane-chat-composer__auto-improve"
          title={t('tabContexts.autoImproveHint')}
        >
          <Icon name="sparkles" size={13} />
          <span className="plane-chat-composer__auto-improve-label">
            {t('tabContexts.autoImprove')}
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={autoImprove}
            disabled={selectedContextIds.length === 0}
            onChange={event => onAutoImproveChange(event.target.checked)}
          />
          <span aria-hidden="true" />
        </label>

        <button
          type="button"
          className={[
            'plane-chat-composer__loop',
            loopMode ? 'plane-chat-composer__loop--on' : '',
            loopActive ? 'plane-chat-composer__loop--active' : '',
          ].filter(Boolean).join(' ')}
          title={t('agentPane.loopHint')}
          aria-label={t('agentPane.loopTitle')}
          aria-pressed={loopMode}
          disabled={loopActive}
          onClick={onToggleLoop}
        >
          <Icon name="repeat" size={13} />
          <span className="plane-chat-composer__loop-label">
            {t('agentPane.loopBar')}
          </span>
        </button>
      </div>
    </div>
  )
}
