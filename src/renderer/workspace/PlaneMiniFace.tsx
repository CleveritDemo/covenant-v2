import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneMiniFace.css'

export interface PlaneMiniFaceProps {
  name: string
  busy?: boolean
  provider?: AgentCliProvider
  /** Muestra chip de orquestador junto al proveedor. */
  coordination?: 'none' | 'orchestrator'
  statusLabel: string
  /** Densidad visual; compact reduce padding/gaps para listas y modales. */
  density?: 'default' | 'compact'
  configLabel?: string
  deleteLabel?: string
  onConfigure?: () => void
  onDelete?: () => void
  /** Contextos anidados (lista con nombres) debajo del cuerpo. */
  children?: React.ReactNode
}

/** Cara mini del agente: card con proveedor, estado y contextos. */
export const PlaneMiniFace: React.FC<PlaneMiniFaceProps> = ({
  name,
  busy = false,
  provider = 'claude',
  coordination = 'none',
  statusLabel,
  density = 'default',
  configLabel,
  deleteLabel,
  onConfigure,
  onDelete,
  children,
}) => {
  const { t } = useT()
  return (
  <div
    className={[
      'plane-mini-face',
      busy ? 'plane-mini-face--busy' : '',
      density === 'compact' ? 'plane-mini-face--compact' : '',
      provider === 'cursor' ? 'plane-mini-face--cursor' : 'plane-mini-face--claude',
    ].filter(Boolean).join(' ')}
  >
    <div className="plane-mini-face__glow" aria-hidden="true" />
    <div className="plane-mini-face__header">
      <div className="plane-mini-face__identity">
        <span className="plane-mini-face__name" title={name}>{name}</span>
        <span
          className={[
            'plane-mini-face__provider',
            provider === 'cursor'
              ? 'plane-mini-face__provider--cursor'
              : 'plane-mini-face__provider--claude',
          ].join(' ')}
          title={provider === 'cursor' ? t('agentPane.cursor') : t('agentPane.claude')}
          aria-label={provider === 'cursor' ? t('agentPane.cursor') : t('agentPane.claude')}
        >
          <Icon name={provider === 'cursor' ? 'sparkles' : 'bot'} size={9} aria-hidden />
        </span>
        {coordination === 'orchestrator' ? (
          <span
            className="plane-mini-face__provider plane-mini-face__provider--orchestrator"
            title={t('agentPane.orchestratorBadge')}
            aria-label={t('agentPane.orchestratorBadge')}
          >
            <Icon name="git-branch" size={9} aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="plane-mini-face__header-end">
        {busy ? <PlaneBusyDot /> : null}
        {onConfigure && configLabel ? (
          <button
            type="button"
            className="plane-mini-face__action"
            title={configLabel}
            aria-label={configLabel}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              onConfigure()
            }}
            onPointerDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerUp={event => event.stopPropagation()}
          >
            <Icon name="settings" size={11} />
          </button>
        ) : null}
        {onDelete && deleteLabel ? (
          <button
            type="button"
            className="plane-mini-face__action plane-mini-face__action--danger"
            title={deleteLabel}
            aria-label={deleteLabel}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              onDelete()
            }}
            onPointerDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerUp={event => event.stopPropagation()}
          >
            <Icon name="trash" size={11} />
          </button>
        ) : null}
      </div>
    </div>
    <div className="plane-mini-face__body">
      <span className="plane-mini-face__status" title={statusLabel}>{statusLabel}</span>
    </div>
    {children ? (
      <div className="plane-mini-face__nodes">
        {children}
      </div>
    ) : null}
  </div>
  )
}
