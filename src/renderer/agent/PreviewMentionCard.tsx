import React from 'react'
import { Tooltip } from '../components/ui/Tooltip'
import { Icon } from '../components/ui/Icon'
import './PreviewMentionCard.css'

export interface PreviewMentionCardProps {
  fileName: string
  label: string
  onOpen: (fileName: string) => void
  disabled?: boolean
  disabledTitle?: string
}

/** Chip inline para abrir un artefacto `.gravity/previews/` mencionado en el chat. */
export const PreviewMentionCard: React.FC<PreviewMentionCardProps> = ({
  fileName,
  label,
  onOpen,
  disabled = false,
  disabledTitle,
}) => {
  const button = (
    <button
      type="button"
      className="preview-mention-card"
      disabled={disabled}
      aria-label={label}
      onClick={() => onOpen(fileName)}
    >
      <Icon name="eye" size={12} />
      <span className="preview-mention-card__label">{label}</span>
      <span className="preview-mention-card__file">{fileName}</span>
    </button>
  )

  if (disabled && disabledTitle) {
    return <Tooltip content={disabledTitle}>{button}</Tooltip>
  }

  return button
}
