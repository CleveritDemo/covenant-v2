import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'

interface TerminalScrollDownProps {
  onPointerDown: (e: React.MouseEvent) => void
  onClick: () => void
}

export const TerminalScrollDown: React.FC<TerminalScrollDownProps> = ({
  onPointerDown,
  onClick,
}) => {
  const { t } = useT()
  return (
    <button
      type="button"
      tabIndex={-1}
      className="terminal-scroll-down-btn terminal-chrome-btn"
      aria-label={t('paneToolbar.scrollDownAriaLabel')}
      onMouseDown={onPointerDown}
      onClick={onClick}
    >
      <Icon name="chevron-down" size={12} />
    </button>
  )
}
