import React, { useMemo, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import {
  EMPTY_TAB_CONTEXT_FILTER,
  agentsUsingContext,
  filterTabContexts,
  presentContextKinds,
  unusedContextCount,
  type ContextAgentFilter,
  type TabContextListFilter,
} from '@shared/tabContextAgentUsage'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Input } from '../components/ui/Input'
import { AgentFace as UiAgentFace } from '../components/ui/AgentFace'
import { CONTEXT_USED_BY_LIMIT } from '../components/ui/ContextCheckOption'
import { CoordinationBadge } from '../components/ui/CoordinationBadge'
import { contextIconName } from './tabContextKindIcons'
import {
  agentMonogram,
  normalizeContextColor,
  paletteColorForSeed,
  resolveContextColor,
} from '@shared/tabContextAppearance'

interface Props {
  contexts: TabContext[]
  /** Catálogo del proyecto: da CLI y rol a las filas de results. */
  agents?: ProjectAgentDefinition[]
  selectedId: string | null
  onNew: () => void
  onSelect: (contextId: string) => void
  onEdit: (context: TabContext) => void
  onDelete: (context: TabContext) => void
}

/** Color de identidad del agente; coincide con el de su fila de results. */
export const agentFaceColor = (agent: ProjectAgentDefinition): string =>
  paletteColorForSeed(agentResultContextIdForSlug(agent.id))

/** Cara del agente: monograma teñido + marca del CLI. */
export const AgentFace: React.FC<{
  agent: ProjectAgentDefinition
  color?: string
  small?: boolean
  stacked?: boolean
}> = ({ agent, color, small = false, stacked = false }) => (
  <UiAgentFace
    monogram={agent.monogram || agentMonogram(agent.name ?? agent.id)}
    provider={agent.provider}
    color={color ?? agentFaceColor(agent)}
    size={small ? 'sm' : 'md'}
    stacked={stacked}
  />
)

export const TabContextsList: React.FC<Props> = ({
  contexts,
  agents = [],
  selectedId,
  onNew,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useT()
  const [filter, setFilter] = useState<TabContextListFilter>(EMPTY_TAB_CONTEXT_FILTER)

  const visible = useMemo(
    () => filterTabContexts(contexts, agents, filter),
    [contexts, agents, filter],
  )
  const kinds = useMemo(() => presentContextKinds(contexts), [contexts])
  const projectContexts = visible.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = visible.filter(context => context.kind === 'agentResult')
  const agentName = (agent: ProjectAgentDefinition): string => agent.name?.trim() || agent.id

  /** Un solo toggle: volver a pulsar el chip activo limpia el filtro. */
  const pickAgent = (value: ContextAgentFilter) => {
    setFilter(prev => ({ ...prev, agent: prev.agent === value ? 'all' : value }))
  }

  const renderChip = (
    key: string,
    label: string,
    count: number,
    active: boolean,
    onClick: () => void,
    face?: React.ReactNode,
  ) => (
    <button
      key={key}
      type="button"
      className={`tab-contexts__chip${active ? ' tab-contexts__chip--on' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {face}
      <span className="tab-contexts__chip-label">{label}</span>
      <span className="tab-contexts__chip-count">{count}</span>
    </button>
  )

  /** Monograma del agente + marca del CLI y rol, si el catálogo lo conoce. */
  const renderAgentFace = (context: TabContext) => {
    const agent = agents.find(item => agentResultContextIdForSlug(item.id) === context.id)
    const color = normalizeContextColor(context.color) ?? paletteColorForSeed(context.id)
    if (!agent) {
      return (
        <UiAgentFace
          monogram={agentMonogram(context.name)}
          color={color}
        />
      )
    }
    return <AgentFace agent={agent} color={color} />
  }

  /** Chip de coordinación: mismos glifos que la cara mini del plano. */
  const renderCoordination = (context: TabContext) => {
    const agent = agents.find(item => agentResultContextIdForSlug(item.id) === context.id)
    const coordination = agent?.coordination ?? 'none'
    const label = t(
      coordination === 'orchestrator'
        ? 'agentPane.orchestratorBadge'
        : coordination === 'productOwner'
          ? 'agentPane.productOwnerBadge'
          : 'agentPane.specialistBadge',
    )
    return (
      <CoordinationBadge coordination={coordination} label={label} variant="inline" />
    )
  }

  /** Quién carga el contexto: la señal que faltaba para saber si sirve a alguien. */
  const renderUsage = (context: TabContext) => {
    if (agents.length === 0) return null
    const users = agentsUsingContext(agents, context.id)
    if (users.length === 0) {
      return <span className="tab-contexts__unused">{t('tabContexts.usedByNone')}</span>
    }
    return (
      <span
        className="tab-contexts__stack"
        aria-label={t('tabContexts.usedByAria', { agents: users.map(agentName).join(', ') })}
        role="img"
      >
        {users.slice(0, CONTEXT_USED_BY_LIMIT).map(agent => (
          <AgentFace key={agent.id} agent={agent} small stacked />
        ))}
        {users.length > CONTEXT_USED_BY_LIMIT && (
          <span className="tab-contexts__stack-more">+{users.length - CONTEXT_USED_BY_LIMIT}</span>
        )}
      </span>
    )
  }

  /** `showKind` false en un grupo cuya cabecera ya nombra el tipo. */
  const renderItem = (context: TabContext, showKind = true) => (
    <div
      key={context.id}
      className={`tab-contexts__item${selectedId === context.id ? ' tab-contexts__item--active' : ''}`}
    >
      <button type="button" onClick={() => onSelect(context.id)}>
        {context.kind === 'agentResult' ? renderAgentFace(context) : (
          <span
            className="tab-contexts__item-icon"
            style={{ color: resolveContextColor(context) }}
          >
            <Icon name={contextIconName(context)} size={16} />
          </span>
        )}
        <span className="tab-contexts__item-text">
          <span className="tab-contexts__item-name">
            <strong>{context.name}</strong>
            {context.kind === 'agentResult' ? renderCoordination(context) : null}
          </span>
          <span className="tab-contexts__item-file">
            {showKind
              ? `${t(`tabContexts.kind_${context.kind}`)} · ${context.fileName}`
              : context.fileName}
          </span>
        </span>
        {renderUsage(context)}
      </button>
      <button
        type="button"
        className="tab-contexts__edit"
        aria-label={t('tabContexts.edit')}
        onClick={() => onEdit(context)}
      >
        <Icon name="pencil" size={13} />
      </button>
      <button
        type="button"
        className="tab-contexts__delete"
        aria-label={t('tabContexts.delete')}
        onClick={() => { void onDelete(context) }}
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  )

  return (
    <aside className="tab-contexts__list">
      <div className="tab-contexts__list-actions">
        <Button variant="secondary" onClick={onNew}>
          <Icon name="plus" size={14} />
          {t('tabContexts.new')}
        </Button>
      </div>

      {contexts.length > 0 && (
        <div className="tab-contexts__filters">
          <Input
            size="sm"
            type="search"
            value={filter.query}
            aria-label={t('tabContexts.filterSearchAria')}
            placeholder={t('tabContexts.filterSearchPlaceholder')}
            onChange={event => setFilter(prev => ({ ...prev, query: event.target.value }))}
          />
          {agents.length > 0 && (
            <div className="tab-contexts__filter-row">
              <span className="tab-contexts__filter-label">{t('tabContexts.filterAgentLabel')}</span>
              <div
                className="tab-contexts__chips"
                role="group"
                aria-label={t('tabContexts.filterAgentLabel')}
              >
                {renderChip(
                  'all',
                  t('tabContexts.filterAll'),
                  contexts.length,
                  filter.agent === 'all',
                  () => pickAgent('all'),
                )}
                {agents.map(agent => renderChip(
                  agent.id,
                  agentName(agent),
                  agent.contextIds?.length ?? 0,
                  filter.agent === agent.id,
                  () => pickAgent(agent.id),
                  <AgentFace agent={agent} small />,
                ))}
                {renderChip(
                  'unused',
                  t('tabContexts.filterUnused'),
                  unusedContextCount(contexts, agents),
                  filter.agent === 'unused',
                  () => pickAgent('unused'),
                )}
              </div>
            </div>
          )}
          {kinds.length > 1 && (
            <div className="tab-contexts__filter-row">
              <span className="tab-contexts__filter-label">{t('tabContexts.filterKindLabel')}</span>
              <div
                className="tab-contexts__chips"
                role="group"
                aria-label={t('tabContexts.filterKindLabel')}
              >
                {renderChip(
                  'all',
                  t('tabContexts.filterAll'),
                  contexts.length,
                  filter.kind === 'all',
                  () => setFilter(prev => ({ ...prev, kind: 'all' })),
                )}
                {kinds.map(kind => renderChip(
                  kind,
                  t(`tabContexts.kind_${kind}`),
                  contexts.filter(context => context.kind === kind).length,
                  filter.kind === kind,
                  () => setFilter(prev => ({ ...prev, kind: prev.kind === kind ? 'all' : kind })),
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Solo scrollean las filas: con el filtro dentro, `position: sticky`
          dejaba pasar las filas por encima al llegar arriba del todo. */}
      <div className="tab-contexts__rows">
        {contexts.length === 0 && (
          <p className="tab-contexts__empty">{t('tabContexts.empty')}</p>
        )}
        {contexts.length > 0 && visible.length === 0 && (
          <p className="tab-contexts__empty">{t('tabContexts.filterNoMatch')}</p>
        )}
        {projectContexts.length > 0 && (
          <div className="tab-contexts__group">
            <h4 className="tab-contexts__group-title">
              {t('tabContexts.groupProject')}
              <span>{projectContexts.length}</span>
            </h4>
            {projectContexts.map(context => renderItem(context))}
          </div>
        )}
        {agentResultContexts.length > 0 && (
          <div className="tab-contexts__group">
            <h4 className="tab-contexts__group-title">
              {t('tabContexts.groupAgentResults')}
              <span>{agentResultContexts.length}</span>
            </h4>
            {agentResultContexts.map(context => renderItem(context, false))}
          </div>
        )}
      </div>
    </aside>
  )
}
