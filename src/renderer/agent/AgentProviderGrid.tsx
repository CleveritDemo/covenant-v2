import React from 'react'
import {
  AGENT_CLI_PROVIDER_IDS,
  agentCliSpec,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { BrandIcon, ChoiceCard } from '../components/ui'
import './AgentProviderGrid.css'

export interface AgentProviderGridProps {
  value: AgentCliProvider
  fallbackValue?: AgentCliProvider
  /** Vacío mientras se resuelve; entonces no se afirma nada sobre el PATH. */
  statuses: Partial<Record<AgentCliProvider, AgentCliResolution>>
  disabled?: boolean
  fallbackDisabledIds?: readonly AgentCliProvider[]
  onPick: (provider: AgentCliProvider) => void
}

/** Rejilla de CLIs con estado de instalación (sustituye al segmented de 9 opciones). */
export const AgentProviderGrid: React.FC<AgentProviderGridProps> = ({
  value,
  fallbackValue,
  statuses,
  disabled = false,
  fallbackDisabledIds = [],
  onPick,
}) => {
  const { t } = useT()

  return (
    <div className="agent-provider-grid" role="group" aria-label={t('agentPane.providerLabel')}>
      {AGENT_CLI_PROVIDER_IDS.map(provider => {
        const status = statuses[provider]
        const missing = status ? status.path === null : false
        const isPrimary = provider === value
        const isFallback = provider === fallbackValue
        const selected = isPrimary || isFallback
        const fallbackBlocked = fallbackDisabledIds.includes(provider)
        const cardDisabled = disabled || fallbackBlocked
        return (
          <ChoiceCard
            key={provider}
            role="button"
            aria-pressed={selected}
            selected={selected}
            disabled={cardDisabled}
            icon={<BrandIcon provider={provider} size={18} />}
            onClick={() => {
              if (!cardDisabled) onPick(provider)
            }}
          >
            {isPrimary ? (
              <span className="agent-provider-grid__badge">{t('agentPane.providerPrimaryBadge')}</span>
            ) : isFallback ? (
              <span className="agent-provider-grid__badge agent-provider-grid__badge--fallback">
                {t('agentPane.providerFallbackBadge')}
              </span>
            ) : null}
            <strong className="agent-provider-grid__name">{agentCliSpec(provider).label}</strong>
            <span
              className={`agent-provider-grid__state${missing ? ' agent-provider-grid__state--missing' : ''}`}
            >
              {!status
                ? t('agentPane.providerChecking')
                : missing
                  ? t('agentPane.providerMissing')
                  : status.version ?? t('agentPane.providerInstalled')}
            </span>
          </ChoiceCard>
        )
      })}
    </div>
  )
}
