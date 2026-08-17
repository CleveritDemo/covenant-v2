import React from 'react'
import { Icon, type IconName } from '../components/ui/Icon'

export type PlaneFabKind = 'agent' | 'terminal' | 'bootstrap'

export interface PlaneFabProps {
  kind: PlaneFabKind
  label: string
  disabled?: boolean
  /** Tooltip/aria cuando disabled (p. ej. falta carpeta). */
  disabledTitle?: string
  onClick: () => void
}

const FAB_ICONS: Record<PlaneFabKind, IconName> = {
  agent: 'bot',
  terminal: 'terminal',
  bootstrap: 'users',
}

/** FAB circular del plano (agente / terminal / bootstrap equipo). */
export const PlaneFab: React.FC<PlaneFabProps> = ({
  kind,
  label,
  disabled = false,
  disabledTitle,
  onClick,
}) => {
  const title = disabled ? (disabledTitle || label) : label
  return (
    <button
      type="button"
      className={['plane-fab', `plane-fab--${kind}`].join(' ')}
      disabled={disabled}
      aria-label={title}
      onClick={(event) => {
        // Un click con puntero deja el botón enfocado y el siguiente Enter lo
        // re-dispara: abría una segunda ventana. `detail === 0` es teclado
        // (Enter/Space), y ahí el foco debe quedarse donde está.
        if (event.detail > 0) event.currentTarget.blur()
        onClick()
      }}
    >
      <Icon name={FAB_ICONS[kind]} size={18} />
    </button>
  )
}
