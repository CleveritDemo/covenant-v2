import React from 'react'
import { Gravity } from '../agent/Gravity'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneIdleGravity.css'

export interface PlaneIdleGravityProps {
  /** Meta tipográfica encima del título (p. ej. «Gravity»). */
  emptyTitle?: string
  /** Hint bajo el título cuando el plano no tiene paneles. */
  emptyHint?: string
  /** CTA para elegir carpeta cuando aún no hay project folder. */
  selectFolderLabel?: string
  selectFolderTitle?: string
  onSelectProjectFolder?: () => void
  bootstrapAgentsLabel?: string
  bootstrapAgentsTitle?: string
  /** Hint tipográfico bajo el CTA de crear equipo. */
  bootstrapAgentsHint?: string
  /** Reservado: el idle ya no muestra «Crear equipo» deshabilitado. */
  bootstrapAgentsDisabledTitle?: string
  showBootstrapAgents?: boolean
  canBootstrapAgents?: boolean
  onBootstrapAgents?: () => void
}

/**
 * Gravity + copy (misma gramática que HeroConfirmOverlay:
 * meta → CTA ghost → hint). Sin overlay: solo el interior sobre el plano.
 */
export const PlaneIdleGravity: React.FC<PlaneIdleGravityProps> = ({
  emptyTitle,
  emptyHint,
  selectFolderLabel,
  selectFolderTitle,
  onSelectProjectFolder,
  bootstrapAgentsLabel,
  bootstrapAgentsTitle,
  bootstrapAgentsHint,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
}) => {
  // Sin carpeta: CTA de seleccionar folder. Con carpeta: CTA de crear equipo.
  // No mostramos «Crear equipo» deshabilitado — se sustituye por la instrucción.
  const showSelectFolder = Boolean(
    showBootstrapAgents
      && !canBootstrapAgents
      && selectFolderLabel
      && onSelectProjectFolder,
  )
  const showCreateTeam = Boolean(
    showBootstrapAgents
      && canBootstrapAgents
      && bootstrapAgentsLabel
      && onBootstrapAgents,
  )

  const actionLabel = showSelectFolder
    ? selectFolderLabel!
    : showCreateTeam
      ? bootstrapAgentsLabel!
      : null
  const actionTitle = showSelectFolder
    ? (selectFolderTitle || selectFolderLabel)
    : showCreateTeam
      ? (bootstrapAgentsTitle || bootstrapAgentsLabel)
      : undefined
  const onAction = showSelectFolder
    ? onSelectProjectFolder
    : showCreateTeam
      ? onBootstrapAgents
      : undefined

  const meta = emptyTitle?.trim() || ''
  const rawHint = showCreateTeam
    ? (bootstrapAgentsHint?.trim() || bootstrapAgentsTitle?.trim() || '')
    : (emptyHint?.trim() || '')
  const hint = rawHint && rawHint !== actionLabel ? rawHint : ''

  const showCopy = Boolean(meta || actionLabel || hint)
  const interactive = Boolean(actionLabel && onAction)

  return (
    <div
      className="plane-idle-gravity"
      aria-hidden={interactive ? undefined : true}
    >
      <div className="plane-idle-gravity__stack">
        <Gravity size="solo" />
        {showCopy ? (
          <div className="plane-idle-gravity__copy">
            {meta ? (
              <p className="plane-idle-gravity__meta">{meta}</p>
            ) : null}
            {actionLabel && onAction ? (
              <Tooltip content={actionTitle || actionLabel}>
                <button
                  type="button"
                  className="plane-idle-gravity__cta plane-idle-gravity__cta--ghost"
                  aria-label={actionTitle || actionLabel}
                  onClick={onAction}
                >
                  {actionLabel}
                </button>
              </Tooltip>
            ) : null}
            {hint ? (
              <p className="plane-idle-gravity__hint">{hint}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
