import React from 'react'
import './FileExplorer.css'

export interface FileExplorerMenuItemProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/** Ítem de menú contextual / new-menu del explorador. */
export const FileExplorerMenuItem: React.FC<FileExplorerMenuItemProps> = ({
  label,
  onClick,
  danger = false,
  disabled = false,
}) => (
  <button
    type="button"
    role="menuitem"
    className={[
      'file-explorer-context-menu__item',
      danger ? 'file-explorer-context-menu__item--danger' : '',
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    onClick={onClick}
  >
    {label}
  </button>
)
