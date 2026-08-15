import React, { useMemo } from 'react'
import {
  coordinationCanDelegate,
  persistableDelegateTo,
  resolveDelegateToPolicy,
  type AgentCoordination,
  type DelegateToPolicy,
} from '@shared/agentOrchestration'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { agentMonogram, paletteColorForSeed } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { AgentFace, ContextCheckOption, SettingToggle } from '../components/ui'
import './AgentDelegateToPolicyEditor.css'

export interface DelegateToPeerAgent {
  id: string
  name: string
  coordination?: AgentCoordination
  provider?: AgentCliProvider
  monogram?: string
}

export interface AgentDelegateToPolicyEditorProps {
  value?: DelegateToPolicy
  /** Otros agentes del tab (especialistas elegibles). */
  agents?: DelegateToPeerAgent[]
  disabled?: boolean
  onChange: (policy: DelegateToPolicy | undefined) => void
}

/** Editor delegateTo solo para orquestador: todos (*) o ids de especialistas. */
export const AgentDelegateToPolicyEditor: React.FC<AgentDelegateToPolicyEditorProps> = ({
  value,
  agents = [],
  disabled = false,
  onChange,
}) => {
  const { t } = useT()
  const effective = useMemo(
    () => resolveDelegateToPolicy('orchestrator', value),
    [value],
  )
  const allSpecialists = (effective.agentIds ?? []).includes('*')
  const selectedIds = useMemo(() => new Set(
    (effective.agentIds ?? [])
      .filter(id => id !== '*')
      .map(id => id.trim().toLowerCase())
      .filter(Boolean),
  ), [effective.agentIds])

  const specialists = useMemo(
    () => agents.filter(agent => !coordinationCanDelegate(agent.coordination)),
    [agents],
  )

  const commit = (agentIds: string[]): void => {
    onChange(persistableDelegateTo('orchestrator', { agentIds }))
  }

  const toggleAllSpecialists = (checked: boolean): void => {
    if (checked) {
      commit(['*'])
      return
    }
    commit([...selectedIds])
  }

  const toggleSpecialist = (agentId: string, checked: boolean): void => {
    const key = agentId.trim().toLowerCase()
    const next = new Set(selectedIds)
    if (checked) next.add(key)
    else next.delete(key)
    commit([...next])
  }

  return (
    <div className="agent-delegate-to-policy">
      <span className="agent-delegate-to-policy__label">{t('agentPane.delegateToLabel')}</span>
      <p className="agent-delegate-to-policy__hint">{t('agentPane.delegateToHint')}</p>

      <SettingToggle
        checked={allSpecialists}
        disabled={disabled}
        title={t('agentPane.delegateToAnySpecialists')}
        description={t('agentPane.delegateToAnySpecialistsHint')}
        hint={t('agentPane.delegateToAnySpecialistsHint')}
        onChange={toggleAllSpecialists}
      />

      {!allSpecialists ? (
        <section
          className="agent-delegate-to-policy__specialists"
          aria-label={t('agentPane.delegateToSpecialistsList')}
        >
          <h5 className="agent-delegate-to-policy__group-title">
            {t('agentPane.delegateToSpecialistsList')}
            <span className="agent-delegate-to-policy__group-count">
              {selectedIds.size}
              /
              {specialists.length}
            </span>
          </h5>
          {specialists.length === 0 ? (
            <p className="agent-delegate-to-policy__hint">{t('agentPane.delegateToSpecialistsEmpty')}</p>
          ) : (
            <div className="agent-delegate-to-policy__list" role="group">
              {specialists.map(agent => {
                const checked = selectedIds.has(agent.id.trim().toLowerCase())
                const label = agent.name.trim() || agent.id
                return (
                  <ContextCheckOption
                    key={agent.id}
                    appearance="panel"
                    face={(
                      <AgentFace
                        monogram={agent.monogram?.trim() || agentMonogram(label)}
                        provider={agent.provider}
                        color={paletteColorForSeed(agentResultContextIdForSlug(agent.id))}
                      />
                    )}
                    name={label}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleSpecialist(agent.id, !checked)}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
