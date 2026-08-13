import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { isAgentOwnResultContext } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { Button, ContextCheckOption } from '../components/ui'
import { contextIconName } from './tabContextKindIcons'
import './AgentConfigContextSummary.css'

export interface AgentConfigContextSummaryProps {
  diskContexts: TabContext[]
  selectedContextIds: string[]
  locked: boolean
  loopActive: boolean
  /** Slug del agente: oculta su propio results en el picker. */
  agentId?: string
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
}

/** Picker checkbox de contextos; Gestionar = CRUD. */
export const AgentConfigContextSummary: React.FC<AgentConfigContextSummaryProps> = ({
  diskContexts,
  selectedContextIds,
  locked,
  agentId,
  onToggleContext,
  onOpenContextsModal,
}) => {
  const { t } = useT()
  const selectedCount = selectedContextIds.length
  const hasDiskContexts = diskContexts.length > 0
  const projectContexts = diskContexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = diskContexts.filter(context =>
    context.kind === 'agentResult'
    && !isAgentOwnResultContext(agentId, context.id),
  )

  const renderItem = (context: TabContext) => (
    <li key={context.id}>
      <ContextCheckOption
        appearance="panel"
        name={context.name}
        icon={contextIconName(context)}
        kindLabel={t(`tabContexts.kind_${context.kind}`)}
        checked={selectedContextIds.includes(context.id)}
        disabled={locked}
        onChange={() => onToggleContext(context.id)}
      />
    </li>
  )

  const renderGroup = (title: string, items: TabContext[]) => (
    <div className="agent-config-contexts__group">
      <h5 className="agent-config-contexts__group-title">
        {title}
        <span className="agent-config-contexts__group-count">
          {items.filter(context => selectedContextIds.includes(context.id)).length}
          /
          {items.length}
        </span>
      </h5>
      <ul className="agent-config-contexts__list" role="listbox" aria-multiselectable="true">
        {items.map(renderItem)}
      </ul>
    </div>
  )

  return (
    <div className="agent-config-contexts">
      <header className="agent-config-contexts__head">
        {/* El título de la sección ya lo pinta el panel: aquí solo el estado. */}
        <p className="agent-config-contexts__summary">
          {!hasDiskContexts
            ? t('tabContexts.empty')
            : selectedCount === 0
              ? t('agentPane.configContextsNoneActive')
              : t('tabContexts.pickerSelected', { n: selectedCount })}
        </p>
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
          {projectContexts.length > 0
            && renderGroup(t('tabContexts.groupProject'), projectContexts)}
          {agentResultContexts.length > 0
            && renderGroup(t('tabContexts.groupAgentResults'), agentResultContexts)}
        </div>
      )}
    </div>
  )
}
