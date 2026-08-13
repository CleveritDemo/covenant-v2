import React from 'react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { agentsAssignableToContext, agentsUsingContext } from '@shared/tabContextAgentUsage'
import { useT } from '@i18n/useT'
import { ContextPreviewBody } from '../workspace/ContextContentPreviewModal'
import { AgentFace } from './TabContextsList'

interface Props {
  context: TabContext | null
  cwd: string
  /** Catálogo del proyecto; vacío = no se muestra la banda de asignación. */
  agents?: ProjectAgentDefinition[]
  /** Aplica o quita el contexto a ese agente (escribe el catálogo). */
  onToggleAgent?: (agent: ProjectAgentDefinition, context: TabContext) => void
}

/**
 * Panel derecho del modal de listado: la misma lectura Reporte/Fuente que el
 * modal de un contexto suelto. Sin contexto solo se llega con el proyecto vacío.
 */
export const TabContextsListPreview: React.FC<Props> = ({
  context,
  cwd,
  agents = [],
  onToggleAgent,
}) => {
  const { t } = useT()

  if (!context) {
    return (
      <section className="tab-contexts__preview-pane">
        <p className="tab-contexts__preview-empty">{t('tabContexts.empty')}</p>
      </section>
    )
  }

  const assignable = agentsAssignableToContext(agents, context)
  const users = agentsUsingContext(agents, context.id)
  const showAssign = Boolean(onToggleAgent) && assignable.length > 0

  return (
    <section className="tab-contexts__preview-pane">
      <header className="tab-contexts__preview-header">
        <strong>{context.name}</strong>
        <span>{t(`tabContexts.kind_${context.kind}`)}</span>
      </header>
      {showAssign && (
        <div className="tab-contexts__assign">
          <div className="tab-contexts__assign-head">
            <span className="tab-contexts__filter-label">{t('tabContexts.filterAgentLabel')}</span>
            <small>{users.length}/{assignable.length}</small>
          </div>
          <div className="tab-contexts__chips">
            {assignable.map(agent => {
              const on = users.some(item => item.id === agent.id)
              const name = agent.name?.trim() || agent.id
              return (
                <button
                  key={agent.id}
                  type="button"
                  className={`tab-contexts__chip${on ? ' tab-contexts__chip--on' : ''}`}
                  aria-pressed={on}
                  aria-label={t(on ? 'tabContexts.unassignFromAgent' : 'tabContexts.assignToAgent', {
                    agent: name,
                  })}
                  onClick={() => onToggleAgent?.(agent, context)}
                >
                  <AgentFace agent={agent} small />
                  <span className="tab-contexts__chip-label">{name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* Sin `key`: remontar por contexto tira el contenido ya cargado y el
          panel parpadea en cada cambio de selección. El body ya se recarga. */}
      <ContextPreviewBody context={context} cwd={cwd} />
    </section>
  )
}
