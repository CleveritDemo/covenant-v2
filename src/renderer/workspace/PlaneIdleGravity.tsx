import React from 'react'
import { Gravity } from '../agent/Gravity'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { PlaneOnboardingHome } from './PlaneOnboardingHome'
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
  /** Primera vez: el plano es la casa; no hay wizard. */
  onboardingLocked?: boolean
  orchestratorPath?: '' | 'business' | 'engineer'
  onSelectOrchestratorPath?: (path: 'business' | 'engineer') => void
  onInviteToOrg?: () => void
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
  onboardingLocked = false,
  orchestratorPath = '',
  onSelectOrchestratorPath,
  onInviteToOrg,
}) => {
  const showPathPicker = Boolean(
    onboardingLocked
    && orchestratorPath === ''
    && onSelectOrchestratorPath,
  )
  // Sin carpeta: CTA de seleccionar folder. Con carpeta: CTA de crear equipo.
  // No mostramos «Crear equipo» deshabilitado — se sustituye por la instrucción.
  // Con path vacío el picker manda; carpeta/equipo vuelven cuando ya hay path.
  const showSelectFolder = Boolean(
    !showPathPicker
    && showBootstrapAgents
    && !canBootstrapAgents
    && selectFolderLabel
    && onSelectProjectFolder,
  )
  const showCreateTeam = Boolean(
    !showPathPicker
    && showBootstrapAgents
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
  const rawHint = showPathPicker
    ? ''
    : showCreateTeam
      ? (bootstrapAgentsHint?.trim() || bootstrapAgentsTitle?.trim() || '')
      : (emptyHint?.trim() || '')
  const hint = rawHint && rawHint !== actionLabel ? rawHint : ''
  const guideHint = Boolean(onboardingLocked && hint && showCreateTeam)

  const showCopy = Boolean(meta || actionLabel || hint || showPathPicker)
  const interactive = Boolean((actionLabel && onAction) || showPathPicker)

  const copy = (
    <div className="plane-idle-gravity__copy">
      {meta ? (
        <p
          className={
            onboardingLocked
              ? 'plane-idle-gravity__title'
              : 'plane-idle-gravity__meta'
          }
        >
          {meta}
        </p>
      ) : null}
      {showPathPicker && onSelectOrchestratorPath ? (
        <PlaneOnboardingHome
          onSelectPath={onSelectOrchestratorPath}
          onInviteToOrg={onInviteToOrg}
        />
      ) : null}
      {actionLabel && onAction ? (
        <Tooltip content={actionTitle || actionLabel}>
          <button
            type="button"
            className="plane-idle-gravity__cta plane-idle-gravity__cta--ghost"
            aria-label={actionTitle || actionLabel}
            data-onboarding={showCreateTeam ? 'create-team' : undefined}
            onClick={onAction}
          >
            {onboardingLocked && showSelectFolder ? (
              <Icon name="folder" size={18} />
            ) : null}
            {onboardingLocked && showCreateTeam ? (
              <Icon name="users" size={18} />
            ) : null}
            <span>{actionLabel}</span>
          </button>
        </Tooltip>
      ) : null}
      {hint ? (
        <p
          className={[
            'plane-idle-gravity__hint',
            guideHint ? 'plane-idle-gravity__hint--guide' : '',
          ].filter(Boolean).join(' ')}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )

  return (
    <div
      className="plane-idle-gravity"
      aria-hidden={interactive ? undefined : true}
    >
      <div className="plane-idle-gravity__stack">
        <Gravity size="solo" />
        {showCopy ? copy : null}
      </div>
    </div>
  )
}
