import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { contextIconName } from './tabContextKindIcons'
import { resolveContextColor } from '@shared/tabContextAppearance'

interface Props {
  contexts: TabContext[]
  selectedId: string | null
  onNew: () => void
  onSelect: (contextId: string) => void
  onEdit: (context: TabContext) => void
  onDelete: (context: TabContext) => void
}

export const TabContextsList: React.FC<Props> = ({
  contexts,
  selectedId,
  onNew,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useT()
  const projectContexts = contexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = contexts.filter(context => context.kind === 'agentResult')

  /** `showKind` false en un grupo cuya cabecera ya nombra el tipo. */
  const renderItem = (context: TabContext, showKind = true) => (
    <div
      key={context.id}
      className={`tab-contexts__item${selectedId === context.id ? ' tab-contexts__item--active' : ''}`}
    >
      <button type="button" onClick={() => onSelect(context.id)}>
        <span
          className="tab-contexts__item-icon"
          style={{ color: resolveContextColor(context) }}
        >
          <Icon name={contextIconName(context)} size={16} />
        </span>
        <span className="tab-contexts__item-text">
          <strong>{context.name}</strong>
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
