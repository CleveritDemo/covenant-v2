import React from 'react'
import {
  AGENT_CLI_PROVIDER_IDS,
  agentCliSpec,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'
import type { AgentModelOption } from '@shared/agentCliModels'
import { useT } from '@i18n/useT'
import { BrandIcon, Select } from '../components/ui'
import { AgentProviderCard } from './AgentProviderCard'
import './AgentProviderGrid.css'

export interface AgentProviderModelField {
  value: string
  options: readonly AgentModelOption[]
  loading?: boolean
  disabled?: boolean
}

export interface AgentProviderGridProps {
  value: AgentCliProvider
  fallbackValue?: AgentCliProvider
  /** Vacío mientras se resuelve; entonces no se afirma nada sobre el PATH. */
  statuses: Partial<Record<AgentCliProvider, AgentCliResolution>>
  disabled?: boolean
  fallbackDisabledIds?: readonly AgentCliProvider[]
  onPick: (provider: AgentCliProvider) => void
  primaryModel?: AgentProviderModelField
  fallbackModel?: AgentProviderModelField
  onChangeModel?: (model: string) => void
  onChangeFallbackModel?: (model: string) => void
}

function modelSelectOptions(
  field: AgentProviderModelField,
  defaultLabel: string,
): Array<{ value: string; label: string; hint?: string }> {
  const current = field.value
  const extra = current && !field.options.some(option => option.id === current)
    ? [{ value: current, label: current }]
    : []
  return [
    { value: '', label: defaultLabel },
    ...field.options.map(option => ({
      value: option.id,
      label: option.label,
      hint: option.label === option.id ? undefined : option.id,
    })),
    ...extra,
  ]
}

/** Rejilla de CLIs con estado de instalación (sustituye al segmented de 9 opciones). */
export const AgentProviderGrid: React.FC<AgentProviderGridProps> = ({
  value,
  fallbackValue,
  statuses,
  disabled = false,
  fallbackDisabledIds = [],
  onPick,
  primaryModel,
  fallbackModel,
  onChangeModel,
  onChangeFallbackModel,
}) => {
  const { t } = useT()

  const renderModelControl = (
    field: AgentProviderModelField | undefined,
    onChange: ((model: string) => void) | undefined,
    ariaLabel: string,
    title: string,
  ): React.ReactNode => {
    if (!field || !onChange) return undefined
    return (
      <Select
        size="sm"
        value={field.value}
        disabled={Boolean(field.disabled || field.loading)}
        title={title}
        aria-label={ariaLabel}
        onChange={onChange}
        options={modelSelectOptions(field, t('agentPane.modelDefault'))}
      />
    )
  }

  return (
    <div className="agent-provider-grid" role="group" aria-label={t('agentPane.providerLabel')}>
      {AGENT_CLI_PROVIDER_IDS.map(provider => {
        const status = statuses[provider]
        const missing = status ? status.path === null : false
        const isPrimary = provider === value
        const isFallback = provider === fallbackValue
        const fallbackBlocked = fallbackDisabledIds.includes(provider)
        const cardDisabled = disabled || fallbackBlocked
        const cardRole = isPrimary ? 'primary' as const : isFallback ? 'fallback' as const : undefined
        const modelControl = isPrimary
          ? renderModelControl(
            primaryModel,
            onChangeModel,
            t('agentPane.modelLabel'),
            t('agentPane.modelHint'),
          )
          : isFallback
            ? renderModelControl(
              fallbackModel,
              onChangeFallbackModel,
              t('agentPane.fallbackModelLabel'),
              t('agentPane.fallbackModelHint'),
            )
            : undefined
        return (
          <AgentProviderCard
            key={provider}
            icon={<BrandIcon provider={provider} size={18} />}
            name={agentCliSpec(provider).label}
            state={
              !status
                ? t('agentPane.providerChecking')
                : missing
                  ? t('agentPane.providerMissing')
                  : status.version ?? t('agentPane.providerInstalled')
            }
            stateMissing={missing}
            badge={
              isPrimary
                ? t('agentPane.providerPrimaryBadge')
                : isFallback
                  ? t('agentPane.providerFallbackBadge')
                  : undefined
            }
            cardRole={cardRole}
            disabled={cardDisabled}
            onPick={() => {
              if (!cardDisabled) onPick(provider)
            }}
            modelControl={modelControl}
          />
        )
      })}
    </div>
  )
}
