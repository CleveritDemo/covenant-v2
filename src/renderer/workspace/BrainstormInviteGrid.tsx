import React, { useMemo } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  brainstormCatalogAgentLabel,
  filterBrainstormInvitableAgents,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
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
        return (
          <ChoiceCard
            key={agent.id}
            role="listitem"
            selected={isSelected}
            aria-checked={isSelected}
            onClick={() => onToggle(agent.id)}
          >
            <span className="brainstorm-invite__agent-row">
              <span className="brainstorm-invite__agent-name">
                {brainstormCatalogAgentLabel(agent)}
              </span>
              {role ? (
                <span className="brainstorm-invite__agent-role">{role}</span>
              ) : null}
            </span>
          </ChoiceCard>
        )
      })}
    </div>
  )
}
