import React from 'react'
import { Icon, type IconName } from './Icon'
import './ContextCheckOption.css'

export interface ContextCheckOptionProps {
  name: string
  /** Etiqueta secundaria a la derecha (tipo de contexto, transporte MCP…). */
  kindLabel?: string
  /** Icono a la izquierda del nombre; sin él la fila solo muestra el check. */
  icon?: IconName
  /** Cara custom (p. ej. AgentFace); tiene prioridad sobre `icon`. */
  face?: React.ReactNode
  checked: boolean
  onChange: () => void
  disabled?: boolean
  /** panel = lista de modal; menu = dropdown compacto */
  appearance?: 'panel' | 'menu'
  emphasize?: boolean
  title?: string
  /** Etiqueta de aviso antes del kind (p. ej. «sin usar»). */
  flag?: string
  /** Quién más consume la opción: pila de monogramas al final de la fila. */
  usedBy?: readonly { id: string; monogram: string; name: string }[]
  /** Texto accesible de la pila; recibe los nombres ya unidos. */
  usedByLabel?: string
}

/** Opción multi-select de contexto (checkbox + nombre + kind). */
export const ContextCheckOption: React.FC<ContextCheckOptionProps> = ({
  name,
  kindLabel,
  icon,
  face,
  checked,
  onChange,
  disabled = false,
  appearance = 'panel',
  emphasize = false,
  title,
  flag,
  usedBy,
  usedByLabel,
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
    {face || icon ? (
      <span className="context-check-option__icon" aria-hidden="true">
        {face ?? (icon ? <Icon name={icon} size={14} /> : null)}
      </span>
    ) : null}
    <span className="context-check-option__name">{name}</span>
    {flag ? <span className="context-check-option__flag">{flag}</span> : null}
    {kindLabel ? <span className="context-check-option__kind">{kindLabel}</span> : null}
    {usedBy && usedBy.length > 0 ? (
      <span className="context-check-option__stack" aria-label={usedByLabel}>
        {usedBy.map(user => (
          <span key={user.id} className="context-check-option__monogram">{user.monogram}</span>
        ))}
      </span>
    ) : null}
  </label>
)
