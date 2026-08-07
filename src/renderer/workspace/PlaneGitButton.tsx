import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneLoopsButton.css'

export interface PlaneGitButtonProps {
  label: string
  disabled?: boolean
  disabledTitle?: string
  pressed?: boolean
  onClick: () => void
}

/** Botón icon-only de Git en la barra del plano (piel Loops). */
export const PlaneGitButton: React.FC<PlaneGitButtonProps> = ({
  label,
  disabled = false,
  disabledTitle,
  pressed = false,
  onClick,
}) => {
  const title = disabled ? (disabledTitle || label) : label
  return (
    <button
      type="button"
      className={[
        'plane-loops-button',
        'plane-loops-button--icon-only',
        pressed ? 'plane-loops-button--pressed' : '',
      ].filter(Boolean).join(' ')}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name="git-branch" size={13} />
    </button>
  )
}
