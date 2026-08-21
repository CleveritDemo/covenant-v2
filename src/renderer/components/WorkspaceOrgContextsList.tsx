import React, { useMemo } from 'react'
import { useT } from '@i18n/useT'
import type { TabContext } from '@shared/tabContext'
import {
  agentResultContextIdForSlug,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'
import {
  agentMonogram,
  paletteColorForSeed,
  resolveContextColor,
} from '@shared/tabContextAppearance'
import { contextIconName } from '../agent/tabContextKindIcons'
import { AgentFace } from './ui/AgentFace'
import { Icon } from './ui/Icon'
import './WorkspaceOrgContextsList.css'

export interface WorkspaceOrgContextsListProps {
  contexts: readonly TabContext[]
  agents: readonly ProjectAgentDefinition[]
}

const USED_BY_LIMIT = 4

function agentsUsingContext(
  agents: readonly ProjectAgentDefinition[],
  contextId: string,
): ProjectAgentDefinition[] {
  return agents.filter(agent => agent.contextIds?.includes(contextId))
}

function agentDisplayName(agent: ProjectAgentDefinition): string {
  return agent.name?.trim() || agent.id
}

/** Lista read-only de contextos org con simbología real y pila «usado por». */
export const WorkspaceOrgContextsList: React.FC<WorkspaceOrgContextsListProps> = ({
  contexts,
  agents,
}) => {
  const { t } = useT()

  const sortedContexts = useMemo(() => {
    const withLabels = contexts.map(context => ({
      context,
      kindLabel: t(`tabContexts.kind_${context.kind}`),
    }))
    withLabels.sort((a, b) => {
      const byKind = a.kindLabel.localeCompare(b.kindLabel)
      if (byKind !== 0) return byKind
      return a.context.name.localeCompare(b.context.name)
    })
    return withLabels.map(item => item.context)
  }, [contexts, t])

  return (
    <ul className="ws-org-contexts">
      {sortedContexts.map(context => {
        const contextColor = resolveContextColor(context)
        const users = agentsUsingContext(agents, context.id)
        const userNames = users.map(agentDisplayName)

        return (
          <li key={context.id} className="ws-org-contexts__row">
            <span
              className="ws-org-contexts__icon"
              aria-hidden="true"
              style={{ color: contextColor }}
            >
              <Icon name={contextIconName(context)} size={16} />
            </span>
            <div className="ws-org-contexts__main">
              <div className="ws-org-contexts__head">
                <span className="ws-org-contexts__name">{context.name}</span>
                <span className="ws-org-contexts__kind">
                  {t(`tabContexts.kind_${context.kind}`)}
                </span>
                {context.referenceOnly ? (
                  <span
                    className="ws-org-contexts__ref"
                    style={{ color: contextColor }}
                  >
                    {t('tabContexts.referenceOnly')}
                  </span>
                ) : null}
              </div>
              <span className="ws-org-contexts__file">{context.fileName}</span>
            </div>
            {users.length > 0 ? (
              <span
                className="ws-org-contexts__used-by"
                aria-label={t('tabContexts.usedByAria', { agents: userNames.join(', ') })}
              >
                {users.slice(0, USED_BY_LIMIT).map(agent => (
                  <span key={agent.id} className="ws-org-contexts__face">
                    <AgentFace
                      monogram={
                        agent.monogram?.trim()
                        || agentMonogram(agent.name?.trim() || agent.id)
                      }
                      provider={agent.provider}
                      color={paletteColorForSeed(agentResultContextIdForSlug(agent.id))}
                      size="sm"
                      stacked
                    />
                  </span>
                ))}
                {users.length > USED_BY_LIMIT ? (
                  <span className="ws-org-contexts__more">
                    +{users.length - USED_BY_LIMIT}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="ws-org-contexts__unused">{t('tabContexts.usedByNone')}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
