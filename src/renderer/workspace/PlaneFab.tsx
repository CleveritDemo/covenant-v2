import React from 'react'
import { Tooltip } from '../components/ui'
import { Icon, type IconName } from '../components/ui/Icon'

export type PlaneFabKind = 'agent' | 'terminal' | 'bootstrap'

export interface PlaneFabProps {
  kind: PlaneFabKind
  label: string
  /** Segunda línea del Tooltip: atajo + pista de interacción. */
  hint?: string
  disabled?: boolean
  /** Tooltip/aria cuando disabled (p. ej. falta carpeta). */
  disabledTitle?: string
  onClick: () => void
}

const FAB_ICONS: Record<PlaneFabKind, IconName> = {
  agent: 'bot-plus',
  terminal: 'terminal',
  bootstrap: 'users',
}

/** El alta de agente pide más presencia visual que terminal/bootstrap. */
const FAB_ICON_SIZES: Record<PlaneFabKind, number> = {
  agent: 22,
  terminal: 18,
  bootstrap: 18,
}

/** FAB circular del plano (agente / terminal / bootstrap equipo). */
export const PlaneFab: React.FC<PlaneFabProps> = ({
  kind,
  label,
  hint,
  disabled = false,
  disabledTitle,
  onClick,
}) => {
  const title = disabled ? (disabledTitle || label) : label
  return (
    <Tooltip content={title} hint={hint}>
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
        <Icon name={FAB_ICONS[kind]} size={FAB_ICON_SIZES[kind]} />
      </button>
    </Tooltip>
  )
}
