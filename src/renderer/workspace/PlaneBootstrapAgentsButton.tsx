import React from 'react'
import { Button } from '../components/ui'

export interface PlaneBootstrapAgentsButtonProps {
  label: string
  /** Title/aria detallado (roles); si disabled, usa disabledTitle. */
  title?: string
  disabled?: boolean
  disabledTitle?: string
  onClick: () => void
}

/** CTA de empty state para crear el equipo inicial. */
export const PlaneBootstrapAgentsButton: React.FC<PlaneBootstrapAgentsButtonProps> = ({
  label,
  title,
  disabled = false,
  disabledTitle,
  onClick,
}) => {
  const tip = disabled ? (disabledTitle || title || label) : (title || label)
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={disabled}
      aria-label={tip}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}
