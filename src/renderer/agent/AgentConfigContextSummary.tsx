import React, { useMemo, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { isAgentOwnResultContext } from '@shared/projectAgentCatalog'
import {
  contextUsageByAgent,
  filterAgentContexts,
  groupAgentContexts,
  type ContextGroupId,
  type ContextPickerAgent,
} from '@shared/agentContextPicker'
import { useT } from '@i18n/useT'
import { Button, ContextCheckOption, Icon, Input, SegmentedControl } from '../components/ui'
import { contextIconName } from './tabContextKindIcons'
import './AgentConfigContextSummary.css'

/** Valor del filtro: un grupo, «todos» o «sin usar». */
type ContextFilterValue = ContextGroupId | 'all' | 'unused'

const GROUP_LABEL_KEY = {
  markdown: 'tabContexts.groupMarkdown',
  code: 'tabContexts.groupCode',
  repo: 'tabContexts.groupRepo',
  results: 'tabContexts.groupAgentResults',
} as const satisfies Record<ContextGroupId, string>

export interface AgentConfigContextSummaryProps {
  diskContexts: TabContext[]
  selectedContextIds: string[]
  locked: boolean
  /** Slug del agente: oculta su propio results en el picker. */
  agentId?: string
  /** Catálogo del proyecto: alimenta la pila de monogramas y el tag «sin usar». */
  projectAgents?: ContextPickerAgent[]
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
}

/** Picker checkbox de contextos; Gestionar = CRUD. */
export const AgentConfigContextSummary: React.FC<AgentConfigContextSummaryProps> = ({
  diskContexts,
  selectedContextIds,
  locked,
  agentId,
  projectAgents = [],
  onToggleContext,
  onOpenContextsModal,
}) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ContextFilterValue>('all')

  const hasDiskContexts = diskContexts.length > 0
  const pickable = useMemo(
    () => diskContexts.filter(context => !isAgentOwnResultContext(agentId, context.id)),
    [diskContexts, agentId],
  )
  const usage = useMemo(
    () => contextUsageByAgent(projectAgents, agentId),
    [projectAgents, agentId],
  )
  const selected = useMemo(
    () => pickable.filter(context => selectedContextIds.includes(context.id)),
    [pickable, selectedContextIds],
  )
  const groups = useMemo(() => groupAgentContexts(
    filterAgentContexts(
      pickable,
      {
        query,
        group: filter === 'all' || filter === 'unused' ? undefined : filter,
        onlyUnused: filter === 'unused',
      },
      usage,
      selectedContextIds,
    ),
    selectedContextIds,
  ), [pickable, query, filter, usage, selectedContextIds])

  const filterOptions = useMemo(() => ([
    { value: 'all' as const, label: t('tabContexts.filterAll') },
    { value: 'markdown' as const, label: t('tabContexts.groupMarkdown') },
    { value: 'code' as const, label: t('tabContexts.groupCode') },
    { value: 'repo' as const, label: t('tabContexts.groupRepo') },
    { value: 'results' as const, label: t('tabContexts.groupAgentResults') },
    { value: 'unused' as const, label: t('tabContexts.filterUnused') },
  ]), [t])

  const renderItem = (context: TabContext) => {
    const users = usage.get(context.id) ?? []
    const unused = users.length === 0 && !selectedContextIds.includes(context.id)
    return (
      <li key={context.id}>
        <ContextCheckOption
          appearance="panel"
          name={context.name}
          icon={contextIconName(context)}
          kindLabel={t(`tabContexts.kind_${context.kind}`)}
          flag={unused ? t('tabContexts.usedByNone') : undefined}
          usedBy={users}
          usedByLabel={t('tabContexts.usedByAria', { agents: users.map(u => u.name).join(', ') })}
          checked={selectedContextIds.includes(context.id)}
          disabled={locked}
          onChange={() => onToggleContext(context.id)}
        />
      </li>
    )
  }

  return (
    <div className="agent-config-contexts">
      <header className="agent-config-contexts__head">
        {/* El título de la sección ya lo pinta el panel: aquí solo el estado. */}
        <p className="agent-config-contexts__summary">
          {!hasDiskContexts
            ? t('tabContexts.empty')
            : selected.length === 0
              ? t('agentPane.configContextsNoneActive')
              : t('tabContexts.pickerSelected', { n: selected.length })}
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
        <>
          {/* Bandeja: lo elegido va arriba y se quita sin buscarlo en la lista. */}
          <div className="agent-config-contexts__tray">
            <p className="agent-config-contexts__tray-title">{t('tabContexts.trayTitle')}</p>
            {selected.length === 0 ? (
              <p className="agent-config-contexts__tray-empty">{t('tabContexts.trayEmpty')}</p>
            ) : (
              <ul className="agent-config-contexts__chips">
                {selected.map(context => (
                  <li key={context.id} className="agent-config-contexts__chip">
                    <Icon name={contextIconName(context)} size={12} />
                    {context.name}
                    <button
                      type="button"
                      className="agent-config-contexts__chip-off"
                      aria-label={t('tabContexts.trayRemove', { name: context.name })}
                      disabled={locked}
                      onClick={() => onToggleContext(context.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="agent-config-contexts__filters">
            <Input
              size="sm"
              type="search"
              value={query}
              placeholder={t('tabContexts.filterSearchPlaceholder')}
              aria-label={t('tabContexts.filterSearchAria')}
              onChange={event => setQuery(event.target.value)}
            />
            <SegmentedControl
              size="sm"
              layout="scroll"
              label={t('tabContexts.filterKindLabel')}
              value={filter}
              options={filterOptions}
              onChange={setFilter}
            />
          </div>

          {groups.length === 0 ? (
            <p className="agent-config-contexts__empty">{t('tabContexts.filterNoMatch')}</p>
          ) : (
            <div className="agent-config-contexts__groups">
              {groups.map(group => (
                <div key={group.id} className="agent-config-contexts__group">
                  <h5 className="agent-config-contexts__group-title">
                    {t(GROUP_LABEL_KEY[group.id])}
                    <span className="agent-config-contexts__group-count">
                      {group.selected}
                      /
                      {group.items.length}
                    </span>
                  </h5>
                  <ul className="agent-config-contexts__list" role="listbox" aria-multiselectable="true">
                    {group.items.map(renderItem)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
