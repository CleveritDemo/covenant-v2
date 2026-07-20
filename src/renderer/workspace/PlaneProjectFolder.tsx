import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneProjectFolder.css'

function folderLabel(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || path || '—'
}

export interface PlaneProjectFolderProps {
  folderPath: string
  selectLabel: string
  changeLabel: string
  emptyHint: string
  onSelect: () => void
  onReveal?: () => void
}

export const PlaneProjectFolder: React.FC<PlaneProjectFolderProps> = ({
  folderPath,
  selectLabel,
  changeLabel,
  emptyHint,
  onSelect,
  onReveal,
}) => {
  const hasFolder = Boolean(folderPath.trim())
  return (
    <div className="plane-project-folder">
      <button
        type="button"
        className={[
          'plane-project-folder__btn',
          hasFolder ? 'plane-project-folder__btn--set' : '',
        ].filter(Boolean).join(' ')}
        title={hasFolder ? folderPath : emptyHint}
        aria-label={hasFolder ? changeLabel : selectLabel}
        onClick={onSelect}
      >
        <Icon name={hasFolder ? 'folder-filled' : 'folder'} size={14} />
        <span className="plane-project-folder__label">
          {hasFolder ? folderLabel(folderPath) : selectLabel}
        </span>
      </button>
      {hasFolder && onReveal ? (
        <button
          type="button"
          className="plane-project-folder__reveal"
          title={folderPath}
          aria-label={folderPath}
          onClick={onReveal}
        >
          ↗
        </button>
      ) : null}
    </div>
  )
}
