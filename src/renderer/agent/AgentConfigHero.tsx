import React from 'react'
import { agentMonogram } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { Badge } from '../components/ui'
import type { AgentConfigSection } from './AgentConfigSectionRail'
import './AgentConfigHero.css'

/** Chip de estado de la cabecera; al pulsarlo salta a su sección. */
export interface AgentConfigHeroChip {
  key: string
  label: string
  /** `warn` para ajustes con radio de daño (permisos Auto). */
  tone?: 'default' | 'warn'
  section: AgentConfigSection
}

export interface AgentConfigHeroProps {
  name: string
  /** Monograma explícito del agente; si falta se derivan las iniciales del nombre. */
  monogram?: string
  role: string
  chips: AgentConfigHeroChip[]
  busy: boolean
  loopActive: boolean
  awaitingDelegations?: boolean
  onChipClick: (section: AgentConfigSection) => void
}

function heroMonogram(monogram: string | undefined, name: string): string {
  const explicit = (monogram ?? '').trim().toUpperCase()
  if (explicit) return explicit.slice(0, 2)
  if (!name.trim()) return '?'
  return agentMonogram(name)
}

export const AgentConfigHero: React.FC<AgentConfigHeroProps> = ({
  name,
  monogram,
  role,
  chips,
  busy,
  loopActive,
  awaitingDelegations = false,
  onChipClick,
}) => {
  const { t } = useT()
  const nameEmpty = !name.trim()
  const displayName = name.trim() || t('agentPane.configUnnamed')

  const statusLabel = loopActive
    ? t('agentPane.configStatusLoop')
    : busy || awaitingDelegations
      ? t('agentPane.configStatusBusy')
      : t('agentPane.configStatusIdle')

  return (
    <div className="agent-config-hero">
      <span className="agent-config-hero__avatar" aria-hidden>
        {heroMonogram(monogram, name)}
      </span>
      <div className="agent-config-hero__text">
        <p className="agent-config-hero__name">
          {displayName}
          {role.trim() ? (
            <span className="agent-config-hero__role">{role.trim()}</span>
          ) : null}
        </p>
        <div className="agent-config-hero__chips">
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              className={`agent-config-hero__chip${chip.tone === 'warn' ? ' agent-config-hero__chip--warn' : ''}`}
              onClick={() => onChipClick(chip.section)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {nameEmpty ? (
          <p className="agent-config-hero__edit-hint">{t('agentPane.configHeroEditHint')}</p>
        ) : null}
      </div>
      <Badge variant="muted">{statusLabel}</Badge>
    </div>
  )
}
