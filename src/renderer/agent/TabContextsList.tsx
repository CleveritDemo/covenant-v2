import React from 'react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { BrandIcon } from '../components/ui/BrandIcon'
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
  const projectContexts = contexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = contexts.filter(context => context.kind === 'agentResult')

  /** Monograma del agente + marca del CLI y rol, si el catálogo lo conoce. */
  const renderAgentFace = (context: TabContext) => {
    const agent = agents.find(item => agentResultContextIdForSlug(item.id) === context.id)
    const color = normalizeContextColor(context.color) ?? paletteColorForSeed(context.id)
    return (
      <span
        className="tab-contexts__monogram"
        style={{ '--tab-context-mono': color } as React.CSSProperties}
        aria-hidden
      >
        {agent?.monogram || agentMonogram(context.name)}
        {agent ? (
          <span className="tab-contexts__monogram-brand">
            <BrandIcon provider={agent.provider} size={8} />
          </span>
        ) : null}
      </span>
    )
  }

  /** Chip de coordinación: mismos glifos que la cara mini del plano. */
  const renderCoordination = (context: TabContext) => {
    const agent = agents.find(item => agentResultContextIdForSlug(item.id) === context.id)
    const coordination = agent?.coordination ?? 'none'
    if (coordination === 'none') return null
    const label = t(coordination === 'orchestrator'
      ? 'agentPane.orchestratorBadge'
      : 'agentPane.productOwnerBadge')
    return (
      <span className="tab-contexts__role" title={label} aria-label={label} role="img">
        <Icon name={coordination === 'orchestrator' ? 'git-branch' : 'folder'} size={9} />
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
      </button>
      <button
        type="button"
        className="tab-contexts__edit"
        title={t('tabContexts.edit')}
        aria-label={t('tabContexts.edit')}
        onClick={() => onEdit(context)}
      >
        <Icon name="pencil" size={13} />
      </button>
      <button
        type="button"
        className="tab-contexts__delete"
        title={t('tabContexts.delete')}
        aria-label={t('tabContexts.delete')}
        onClick={() => { void onDelete(context) }}
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  )

  return (
    <aside className="tab-contexts__list">
      <Button variant="secondary" onClick={onNew}>
        <Icon name="plus" size={14} />
        {t('tabContexts.new')}
      </Button>
      {contexts.length === 0 && (
        <p className="tab-contexts__empty">{t('tabContexts.empty')}</p>
      )}
      {projectContexts.length > 0 && (
        <div className="tab-contexts__group">
          <h4 className="tab-contexts__group-title">{t('tabContexts.groupProject')}</h4>
          {projectContexts.map(context => renderItem(context))}
        </div>
      )}
      {agentResultContexts.length > 0 && (
        <div className="tab-contexts__group">
          <h4 className="tab-contexts__group-title">{t('tabContexts.groupAgentResults')}</h4>
          {agentResultContexts.map(context => renderItem(context, false))}
        </div>
      )}
    </aside>
  )
}
