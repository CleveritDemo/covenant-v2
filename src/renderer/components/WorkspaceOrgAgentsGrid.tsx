import React from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import { agentMonogram } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { PlaneMiniFace } from '../workspace/PlaneMiniFace'
import { PlaneAgentContextNodes } from '../workspace/PlaneAgentContextNodes'
import {
  NO_CONTEXT_USAGE,
  resolveAssignedContextChips,
} from '../workspace/resolveAssignedContextChips'
import './WorkspaceOrgAgentsGrid.css'

export interface WorkspaceOrgAgentsGridProps {
  agents: readonly ProjectAgentDefinition[]
  contexts: readonly TabContext[]
}

/** Grid de agentes org en solo lectura: PlaneMiniFace + chips de contexto asignados. */
export function WorkspaceOrgAgentsGrid({
  agents,
  contexts,
}: WorkspaceOrgAgentsGridProps): React.ReactElement {
  const { t } = useT()

  return (
    <ul className="ws-org-agents">
      {agents.map(def => {
        const name = def.name?.trim() || def.id
        const monogram = def.monogram?.trim() || agentMonogram(name)
        return (
          <li key={def.id} className="ws-org-agents__cell">
            <PlaneMiniFace
              name={name}
              monogram={monogram}
              provider={def.provider}
              model={def.model}
              coordination={def.coordination}
              orchestrationWorkStyle={def.orchestrationWorkStyle}
              statusLabel={def.role?.trim() || t('organizations.agentRoleUnset')}
            >
              <PlaneAgentContextNodes
                contexts={resolveAssignedContextChips(
                  def.contextIds ?? [],
                  contexts,
                  NO_CONTEXT_USAGE,
                  kind => t(`tabContexts.kind_${kind}`),
                  agents,
                )}
              />
            </PlaneMiniFace>
          </li>
        )
      })}
    </ul>
  )
}
