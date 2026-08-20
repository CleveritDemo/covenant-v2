import React from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import {
  brainstormCatalogAgentLabel,
  filterBrainstormInvitableAgents,
} from '@shared/brainstormRoom'
import { agentMonogram } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { PlaneMiniFace } from './PlaneMiniFace'
import { PlaneAgentContextNodes } from './PlaneAgentContextNodes'
import { useBrainstormContextDrop } from './brainstormContextDrop'
import { NO_CONTEXT_USAGE, resolveAssignedContextChips } from './resolveAssignedContextChips'
import './BrainstormRosterColumn.css'

export interface BrainstormRosterColumnProps {
  agents: ProjectAgentDefinition[]
  /** Catálogo del tab: chips de contexto en cada mini. */
  contexts?: readonly TabContext[]
  cwd: string
  /** Soltar un contexto del riel sobre una ficha. Sin esto no acepta drops. */
  onAssignContext?: (agentId: string, contextId: string) => void
}

/** Columna derecha de Saved rooms: catálogo invitables, solo lectura. */
export const BrainstormRosterColumn: React.FC<BrainstormRosterColumnProps> = ({
  agents,
  contexts = [],
  cwd,
  onAssignContext,
}) => {
  const { t } = useT()
  const invitable = filterBrainstormInvitableAgents(agents)
  const { dropAgentId, handlersFor } = useBrainstormContextDrop(onAssignContext)

  return (
    <div className="brainstorm-roster">
      <div className="brainstorm-overlay__col-head">
        <span className="brainstorm-overlay__col-title">
          {t('tabs.brainstormsRosterTitle')}
        </span>
        {invitable.length > 0 ? (
          <span className="brainstorm-overlay__col-count">
            {invitable.length}
          </span>
        ) : null}
      </div>
      {invitable.length === 0 ? (
        <p className="brainstorm-roster__hint">{t('tabs.brainstormEmptyCatalog')}</p>
      ) : (
        <div className="brainstorm-roster__list">
          {invitable.map(agent => {
            const label = brainstormCatalogAgentLabel(agent)
            return (
              <div
                key={agent.id}
                className={`brainstorm-roster__item${
                  dropAgentId === agent.id ? ' brainstorm-roster__item--drop' : ''
                }`}
                data-context-link-card={agent.id}
                {...handlersFor(agent.id)}
              >
                <PlaneMiniFace
                  name={label}
                  monogram={agent.monogram?.trim() || agentMonogram(label)}
                  provider={agent.provider}
                  model={agent.model}
                  coordination={agent.coordination}
                  statusLabel={t('tabs.planeIdleAgent')}
                >
                  <PlaneAgentContextNodes
                    contexts={resolveAssignedContextChips(
                      agent.contextIds ?? [],
                      contexts,
                      NO_CONTEXT_USAGE,
                      kind => t(`tabContexts.kind_${kind}`),
                      agents,
                    )}
                    cwd={cwd}
                  />
                </PlaneMiniFace>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
