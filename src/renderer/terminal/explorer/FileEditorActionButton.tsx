import React from 'react'
import './FileExplorer.css'

export interface FileEditorActionButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

/** CTA compacto del editor (reload, abrir grande, revelar). */
export const FileEditorActionButton: React.FC<FileEditorActionButtonProps> = ({
  label,
  onClick,
  disabled = false,
}) => (
  <button
    type="button"
    className="file-editor-panel__special-btn"
    disabled={disabled}
    onClick={onClick}
  >
    {label}
  </button>
)
