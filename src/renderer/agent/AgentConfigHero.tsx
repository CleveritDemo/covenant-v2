import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { agentCliSpec } from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { Badge } from '../components/ui'
import './AgentConfigHero.css'

export interface AgentConfigHeroProps {
  name: string
  role: string
  provider: AgentCliProvider
  modelLabel: string
  busy: boolean
  loopActive: boolean
  awaitingDelegations?: boolean
}

function agentInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export const AgentConfigHero: React.FC<AgentConfigHeroProps> = ({
  name,
  role,
  provider,
  modelLabel,
  busy,
  loopActive,
  awaitingDelegations = false,
}) => {
  const { t } = useT()
  const nameEmpty = !name.trim()
  const displayName = name.trim() || t('agentPane.configUnnamed')
  const providerLabel = agentCliSpec(provider).label
  const metaParts = [
    role.trim() || null,
    providerLabel,
    modelLabel.trim() || t('agentPane.modelDefault'),
  ].filter(Boolean)

  const statusLabel = loopActive
    ? t('agentPane.configStatusLoop')
    : busy || awaitingDelegations
      ? t('agentPane.configStatusBusy')
      : t('agentPane.configStatusIdle')

  return (
    <div className="agent-config-hero">
      <span className="agent-config-hero__avatar" aria-hidden>
        {agentInitial(name)}
      </span>
      <div className="agent-config-hero__text">
        <p className="agent-config-hero__name">{displayName}</p>
        <p className="agent-config-hero__meta">{metaParts.join(' · ')}</p>
        {nameEmpty ? (
          <p className="agent-config-hero__edit-hint">{t('agentPane.configHeroEditHint')}</p>
        ) : null}
      </div>
      <Badge variant="muted">{statusLabel}</Badge>
    </div>
  )
}
