import React from 'react'
import './FileExplorer.css'

export interface FileExplorerMenuItemProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  /** Atajo mostrado a la derecha (sólo etiqueta: el binding vive en el keymap). */
  shortcut?: string
}

/** Ítem de menú contextual / new-menu del explorador. */
export const FileExplorerMenuItem: React.FC<FileExplorerMenuItemProps> = ({
  label,
  onClick,
  danger = false,
  disabled = false,
  shortcut,
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
    <span>{label}</span>
    {shortcut && <span className="file-explorer-context-menu__shortcut">{shortcut}</span>}
  </button>
)
