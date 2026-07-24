import React from 'react'
import { Icon } from '../../components/ui/Icon'
import './FileExplorer.css'

export interface FileEditorSearchNavProps {
  direction: 'prev' | 'next'
  label: string
  shortcutHint: string
  disabled?: boolean
  onClick: () => void
}

/** Navegación prev/next del find del editor. */
export const FileEditorSearchNav: React.FC<FileEditorSearchNavProps> = ({
  direction,
  label,
  shortcutHint,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'file-editor-panel__search-nav',
      direction === 'prev' ? 'file-editor-panel__search-nav--up' : '',
    ].filter(Boolean).join(' ')}
    title={shortcutHint}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="chevron-down" size={10} aria-hidden />
  </button>
)
