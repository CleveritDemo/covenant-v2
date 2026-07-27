import React, { useMemo } from 'react'
import {
  coordinationCanDelegate,
  persistableDelegateTo,
  resolveDelegateToPolicy,
  type AgentCoordination,
  type DelegateToPolicy,
} from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import { SettingToggle } from '../components/ui'
import './AgentDelegateToPolicyEditor.css'

export interface DelegateToPeerAgent {
  id: string
  name: string
  coordination?: AgentCoordination
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
          {specialists.length === 0 ? (
            <p className="agent-delegate-to-policy__hint">{t('agentPane.delegateToSpecialistsEmpty')}</p>
          ) : (
            <div className="agent-delegate-to-policy__list" role="group">
              {specialists.map(agent => {
                const checked = selectedIds.has(agent.id.trim().toLowerCase())
                return (
                  <label key={agent.id} className="agent-delegate-to-policy__check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={event => toggleSpecialist(agent.id, event.target.checked)}
                    />
                    <span>{agent.name.trim() || agent.id}</span>
                  </label>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
