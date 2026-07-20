import React from 'react'
import { Tooltip } from './Tooltip'
import './Toggle.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  icon?: React.ReactNode
  compact?: boolean
  disabled?: boolean
  title?: string
  tabIndex?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  icon,
  compact,
  disabled,
  title,
  tabIndex,
  onKeyDown,
  onClick,
}) => {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      tabIndex={tabIndex}
      className={`toggle${checked ? ' toggle--on' : ''}${compact ? ' toggle--compact' : ''}`}
      onClick={e => {
        onClick?.(e)
        if (!e.defaultPrevented) onChange(!checked)
      }}
      onKeyDown={onKeyDown}
    >
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      {icon && <span className="toggle__icon" aria-hidden="true">{icon}</span>}
      {!compact && <span className="toggle__label">{label}</span>}
    </button>
  )

  if (!title) return button
  return <Tooltip content={title}>{button}</Tooltip>
}
