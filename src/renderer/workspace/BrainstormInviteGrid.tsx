import React, { useMemo } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  brainstormCatalogAgentLabel,
  filterBrainstormInvitableAgents,
} from '@shared/brainstormRoom'
import { agentMonogram, paletteColorForSeed } from '@shared/tabContextAppearance'
import { candidateCeremonyRoles } from '@shared/agileCeremonies'
import { useT } from '@i18n/useT'
import { CEREMONY_ROLE_KEY } from './ceremonyLabels'
import { ChoiceCard } from '../components/ui'
import './BrainstormInviteGrid.css'

export interface BrainstormInviteGridProps {
  agents: ProjectAgentDefinition[]
  selectedIds: readonly string[]
  onToggle: (agentId: string) => void
}

/** Rejilla de invitados: el orden de selección es el orden en que hablan. */
export const BrainstormInviteGrid: React.FC<BrainstormInviteGridProps> = ({
  agents,
  selectedIds,
  onToggle,
}) => {
  const { t } = useT()
  const invitableAgents = useMemo(() => filterBrainstormInvitableAgents(agents), [agents])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  if (invitableAgents.length === 0) {
    return <p className="brainstorm-invite__hint">{t('tabs.brainstormEmptyCatalog')}</p>
  }

  return (
    <div className="brainstorm-invite__list" role="list">
      {invitableAgents.map(agent => {
        const isSelected = selected.has(agent.id)
        const role = agent.role?.trim()
        const label = brainstormCatalogAgentLabel(agent)
        // El monograma es un campo de la ficha (Vanesa → «QA»); derivarlo del
        // nombre solo vale cuando el agente no lo trae puesto.
        const monogram = agent.monogram?.trim() || agentMonogram(label)
        const ceremonyRoles = candidateCeremonyRoles(agent)
        return (
          <ChoiceCard
            key={agent.id}
            role="listitem"
            selected={isSelected}
            aria-checked={isSelected}
            onClick={() => onToggle(agent.id)}
          >
            <span className="brainstorm-invite__agent">
              {/* Mismo color que tendrá su carril en el acta: el agente ya se
                  reconoce por color antes de que la sala arranque. */}
              <span
                className="brainstorm-invite__monogram"
                style={{
                  '--brainstorm-invite-color': paletteColorForSeed(agent.id),
                } as React.CSSProperties}
                aria-hidden
              >
                {monogram}
              </span>
              <span className="brainstorm-invite__agent-row">
                <span className="brainstorm-invite__agent-name">{label}</span>
                {/* Los roles de ceremonia mandan: son los que sientan al
                    agente. El texto libre solo aparece si no hay ninguno. */}
                {ceremonyRoles.length ? (
                  <span className="brainstorm-invite__agent-ceremony">
                    {ceremonyRoles.map(id => t(CEREMONY_ROLE_KEY[id])).join(' · ')}
                  </span>
                ) : role ? (
                  <span className="brainstorm-invite__agent-role">{role}</span>
                ) : null}
              </span>
            </span>
          </ChoiceCard>
        )
      })}
    </div>
  )
}
