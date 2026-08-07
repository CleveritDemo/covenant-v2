import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'

interface TabAddButtonProps {
  onClick: () => void
}

export const TabAddButton: React.FC<TabAddButtonProps> = ({ onClick }) => {
  const { t } = useT()
  return (
    <button
      className="tab-add"
      type="button"
      onClick={onClick}
      title={t('tabs.addTitle')}
      aria-label={t('tabs.addAriaLabel')}
      tabIndex={-1}
    >
      <Icon name="plus" size={13} />
    </button>
  )
}
