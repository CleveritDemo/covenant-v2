import React from 'react'
import './FileExplorer.css'

export interface FileExplorerCreateActionProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  submit?: boolean
  appearance?: 'submit' | 'cancel'
}

/** Acción submit/cancel del formulario crear archivo/carpeta. */
export const FileExplorerCreateAction: React.FC<FileExplorerCreateActionProps> = ({
  label,
  onClick,
  disabled = false,
  submit = false,
  appearance = 'submit',
}) => (
  <button
    type={submit ? 'submit' : 'button'}
    className={
      appearance === 'cancel'
        ? 'file-explorer-tree__create-cancel'
        : 'file-explorer-tree__create-submit'
    }
    disabled={disabled}
    onClick={onClick}
  >
    {label}
  </button>
)
