import React from 'react'
import { Tooltip } from '../components/ui'
import { Icon, type IconName } from '../components/ui/Icon'

export type PlaneFabKind = 'agent' | 'terminal' | 'bootstrap'

export interface PlaneFabProps {
  kind: PlaneFabKind
  label: string
  /** Segunda línea del Tooltip: atajo + pista de interacción. */
  hint?: string
  /** Atajo dentro de la píldora del FAB expandible (solo `agent`). */
  shortcut?: string
  disabled?: boolean
  /** Tooltip/aria cuando disabled (p. ej. falta carpeta). */
  disabledTitle?: string
  /** Ancla del coach mark (`data-onboarding`). */
  dataOnboarding?: string
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

/**
 * FAB del plano (agente / terminal / bootstrap equipo). El de agente se abre
 * en píldora al acercarse; los otros dos son discos con Tooltip.
 */
export const PlaneFab: React.FC<PlaneFabProps> = ({
  kind,
  label,
  hint,
  shortcut,
  disabled = false,
  disabledTitle,
  dataOnboarding,
  onClick,
}) => {
  const title = disabled ? (disabledTitle || label) : label
  // El de agente se abre en píldora con su etiqueta y su atajo dentro: un
  // Tooltip encima diría lo mismo. Deshabilitado no se abre —y ahí el Tooltip
  // es lo único que explica por qué no se puede—, así que ahí se conserva.
  const expands = kind === 'agent' && !disabled
  const button = (
    <button
      type="button"
      className={[
        'plane-fab',
        `plane-fab--${kind}`,
        expands ? 'plane-fab--expands' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-label={title}
      {...(dataOnboarding ? { 'data-onboarding': dataOnboarding } : {})}
      onClick={(event) => {
        // Un click con puntero deja el botón enfocado y el siguiente Enter lo
        // re-dispara: abría una segunda ventana. `detail === 0` es teclado
        // (Enter/Space), y ahí el foco debe quedarse donde está.
        if (event.detail > 0) event.currentTarget.blur()
        onClick()
      }}
    >
      <Icon name={FAB_ICONS[kind]} size={FAB_ICON_SIZES[kind]} />
      {expands ? (
        <span className="plane-fab__label">
          {label}
          {shortcut ? <span className="plane-fab__kbd">{shortcut}</span> : null}
        </span>
      ) : null}
    </button>
  )

  if (expands) return button

  return (
    <Tooltip content={title} hint={hint}>
      {button}
    </Tooltip>
  )
}
