import React from 'react'
import { Icon, type IconName } from './Icon'
import './ContextCheckOption.css'

export interface ContextCheckOptionProps {
  name: string
  /** Etiqueta secundaria a la derecha (tipo de contexto, transporte MCP…). */
  kindLabel?: string
  /** Icono a la izquierda del nombre; sin él la fila solo muestra el check. */
  icon?: IconName
  checked: boolean
  onChange: () => void
  disabled?: boolean
  /** panel = lista de modal; menu = dropdown compacto */
  appearance?: 'panel' | 'menu'
  emphasize?: boolean
  title?: string
}

/** Opción multi-select de contexto (checkbox + nombre + kind). */
export const ContextCheckOption: React.FC<ContextCheckOptionProps> = ({
  name,
  kindLabel,
  icon,
  checked,
  onChange,
  disabled = false,
  appearance = 'panel',
  emphasize = false,
  title,
}) => (
  <label
    className={[
      'context-check-option',
      `context-check-option--${appearance}`,
      checked ? 'context-check-option--on' : '',
      emphasize ? 'context-check-option--emphasize' : '',
      disabled ? 'context-check-option--disabled' : '',
    ].filter(Boolean).join(' ')}
    aria-label={title}
  >
    <input
      type="checkbox"
      role="option"
      aria-selected={checked}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
    <span className="context-check-option__check" aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false">
        <path d="M2.5 6.2 4.8 8.5 9.5 3.6" />
      </svg>
    </span>
    {icon ? (
      <span className="context-check-option__icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
    ) : null}
    <span className="context-check-option__name">{name}</span>
    {kindLabel ? <span className="context-check-option__kind">{kindLabel}</span> : null}
  </label>
)
