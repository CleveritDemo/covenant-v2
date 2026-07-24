import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { Button, ContextCheckOption, SettingToggle } from '../components/ui'
import './AgentConfigContextSummary.css'

export interface AgentConfigContextSummaryProps {
  diskContexts: TabContext[]
  selectedContextIds: string[]
  locked: boolean
  loopActive: boolean
  autoImprove: boolean
  emitResults: boolean
  contextNotice: string
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
  onEmitResultsChange: (checked: boolean) => void
}

/** Picker checkbox de contextos; Gestionar = CRUD. */
export const AgentConfigContextSummary: React.FC<AgentConfigContextSummaryProps> = ({
  diskContexts,
  selectedContextIds,
  locked,
  autoImprove,
  emitResults,
  contextNotice,
  onToggleContext,
  onOpenContextsModal,
  onAutoImproveChange,
  onEmitResultsChange,
}) => {
  const { t } = useT()
  const selectedCount = selectedContextIds.length
  const hasDiskContexts = diskContexts.length > 0
  const projectContexts = diskContexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = diskContexts.filter(context => context.kind === 'agentResult')

  const renderItem = (context: TabContext) => (
    <li key={context.id}>
      <ContextCheckOption
        appearance="panel"
        name={context.name}
        kindLabel={t(`tabContexts.kind_${context.kind}`)}
        checked={selectedContextIds.includes(context.id)}
        disabled={locked}
        onChange={() => onToggleContext(context.id)}
      />
    </li>
  )

  return (
    <div className="agent-config-contexts">
      <header className="agent-config-contexts__head">
        <div>
          <h4 className="agent-config-contexts__title">{t('tabContexts.barTitle')}</h4>
          <p className="agent-config-contexts__summary">
            {!hasDiskContexts
              ? t('tabContexts.empty')
              : selectedCount === 0
                ? t('agentPane.configContextsNoneActive')
                : t('tabContexts.pickerSelected', { n: selectedCount })}
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={locked} onClick={onOpenContextsModal}>
          {t('tabContexts.manage')}
        </Button>
      </header>

      {!hasDiskContexts ? (
        <div className="agent-config-contexts__empty-box">
          <p className="agent-config-contexts__empty">{t('tabContexts.empty')}</p>
          <div className="agent-config-contexts__empty-actions">
            <Button variant="primary" size="sm" disabled={locked} onClick={onOpenContextsModal}>
              {t('tabContexts.manage')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="agent-config-contexts__groups">
          {projectContexts.length > 0 && (
            <div className="agent-config-contexts__group">
              <h5 className="agent-config-contexts__group-title">{t('tabContexts.groupProject')}</h5>
              <ul className="agent-config-contexts__list" role="listbox" aria-multiselectable="true">
                {projectContexts.map(renderItem)}
              </ul>
            </div>
          )}
          {agentResultContexts.length > 0 && (
            <div className="agent-config-contexts__group">
              <h5 className="agent-config-contexts__group-title">{t('tabContexts.groupAgentResults')}</h5>
              <ul className="agent-config-contexts__list" role="listbox" aria-multiselectable="true">
                {agentResultContexts.map(renderItem)}
              </ul>
            </div>
          )}
        </div>
      )}

      <SettingToggle
        checked={autoImprove}
        disabled={locked}
        title={t('tabContexts.autoImprove')}
        description={t('tabContexts.autoImproveHint')}
        hint={t('tabContexts.autoImproveHint')}
        onChange={onAutoImproveChange}
      />
      <SettingToggle
        checked={emitResults}
        disabled={locked}
        title={t('tabContexts.emitResults')}
        description={t('tabContexts.emitResultsHint')}
        hint={t('tabContexts.emitResultsHint')}
        onChange={onEmitResultsChange}
      />
      {contextNotice ? <p className="agent-config-contexts__notice">{contextNotice}</p> : null}
    </div>
  )
}
