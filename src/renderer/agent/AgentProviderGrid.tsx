import React from 'react'
import { AGENT_CLI_PROVIDER_IDS, agentCliSpec, type AgentCliProvider } from '@shared/agentCliProviders'
import type { AgentCliStatusMap } from '@shared/agentCliStatus'
import { useT } from '@i18n/useT'
import { BrandIcon, ChoiceCard } from '../components/ui'
import './AgentProviderGrid.css'

export interface AgentProviderGridProps {
  value: AgentCliProvider
  /** Vacío mientras se detecta; entonces no se afirma nada sobre el PATH. */
  statuses: AgentCliStatusMap
  disabled?: boolean
  onChange: (provider: AgentCliProvider) => void
}

/** Rejilla de CLIs con estado de instalación (sustituye al segmented de 9 opciones). */
export const AgentProviderGrid: React.FC<AgentProviderGridProps> = ({
  value,
  statuses,
  disabled = false,
  onChange,
}) => {
  const { t } = useT()

  return (
    <div className="agent-provider-grid" role="radiogroup" aria-label={t('agentPane.providerLabel')}>
      {AGENT_CLI_PROVIDER_IDS.map(provider => {
        const status = statuses[provider]
        const missing = status?.found === false
        return (
          <ChoiceCard
            key={provider}
            role="radio"
            aria-checked={provider === value}
            selected={provider === value}
            disabled={disabled}
            icon={<BrandIcon provider={provider} size={18} />}
            onClick={() => onChange(provider)}
          >
            <strong className="agent-provider-grid__name">{agentCliSpec(provider).label}</strong>
            <span
              className={`agent-provider-grid__state${missing ? ' agent-provider-grid__state--missing' : ''}`}
              title={status?.path ?? status?.command}
            >
              {!status
                ? t('agentPane.providerChecking')
                : missing
                  ? t('agentPane.providerMissing')
                  : t('agentPane.providerInstalled')}
            </span>
          </ChoiceCard>
        )
      })}
    </div>
  )
}
