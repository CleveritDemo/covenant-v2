import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { KIND_ICONS } from './tabContextKindIcons'

interface Props {
  contexts: TabContext[]
  activeDraftId?: string
  onNew: () => void
  onEdit: (context: TabContext) => void
  onDelete: (context: TabContext) => void
}

export const TabContextsList: React.FC<Props> = ({
  contexts,
  activeDraftId,
  onNew,
  onEdit,
  onDelete,
}) => {
  const { t } = useT()

  return (
    <aside className="tab-contexts__list">
      <Button variant="secondary" onClick={onNew}>
        <Icon name="plus" size={14} />
        {t('tabContexts.new')}
      </Button>
      {contexts.length === 0 && (
        <p className="tab-contexts__empty">{t('tabContexts.empty')}</p>
      )}
      {contexts.map(context => (
        <div
          key={context.id}
          className={`tab-contexts__item${activeDraftId === context.id ? ' tab-contexts__item--active' : ''}`}
        >
          <button onClick={() => { void onEdit(context) }}>
            <span className="tab-contexts__item-icon">
              <Icon name={KIND_ICONS[context.kind]} size={17} />
            </span>
            <span className="tab-contexts__item-text">
              <strong>{context.name}</strong>
              <span>{t(`tabContexts.kind_${context.kind}`)}</span>
              <span className="tab-contexts__item-file">{context.fileName}</span>
            </span>
          </button>
          <button
            className="tab-contexts__delete"
            title={t('tabContexts.delete')}
            onClick={() => { void onDelete(context) }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      ))}
    </aside>
  )
}
