import React from 'react'
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  type AgentIdentityDraft,
} from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { Input, TextArea } from '../components/ui'
import { AgentRulesEditor } from './AgentRulesEditor'
import { AgentConfigSlugField } from './AgentConfigSlugField'
import './AgentConfigIdentityColumn.css'

export interface AgentConfigIdentityColumnProps {
  draft: AgentIdentityDraft
  locked: boolean
  onChange: (patch: Partial<AgentIdentityDraft>) => void
  onCommit: () => void
}

/** Bloque Identidad en columna única (Plane UI). */
export const AgentConfigIdentityColumn: React.FC<AgentConfigIdentityColumnProps> = ({
  draft,
  locked,
  onChange,
  onCommit,
}) => {
  const { t } = useT()

  return (
    <section className="agent-config-identity" aria-label={t('agentPane.configWhoLabel')}>
      <header className="agent-config-identity__head">
        <h3 className="agent-config-identity__title">{t('agentPane.configWhoLabel')}</h3>
      </header>

      <div className="agent-config-identity__row">
        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">{t('agentPane.nameLabel')}</span>
          <Input
            type="text"
            value={draft.name}
            maxLength={AGENT_NAME_MAX_LENGTH}
            disabled={locked}
            placeholder={t('agentPane.namePlaceholder')}
            onChange={event => onChange({ name: event.target.value })}
            onBlur={onCommit}
          />
        </label>

        <label className="agent-config-identity__field">
          <span className="agent-config-identity__label">{t('agentPane.roleLabel')}</span>
          <Input
            type="text"
            value={draft.role}
            maxLength={AGENT_ROLE_MAX_LENGTH}
            disabled={locked}
            placeholder={t('agentPane.rolePlaceholder')}
            onChange={event => onChange({ role: event.target.value })}
            onBlur={onCommit}
          />
        </label>
      </div>

      <AgentConfigSlugField
        value={draft.id}
        locked={locked}
        onChange={id => onChange({ id })}
        onCommit={onCommit}
      />

      <label className="agent-config-identity__field">
        <span className="agent-config-identity__label">{t('agentPane.objectiveLabel')}</span>
        <TextArea
          rows={3}
          value={draft.objective}
          maxLength={AGENT_OBJECTIVE_MAX_LENGTH}
          disabled={locked}
          placeholder={t('agentPane.objectivePlaceholder')}
          onChange={event => onChange({ objective: event.target.value })}
          onBlur={onCommit}
        />
      </label>

      <AgentRulesEditor
        rules={draft.rules}
        disabled={locked}
        onChange={rules => onChange({ rules })}
        onCommit={onCommit}
      />
    </section>
  )
}
