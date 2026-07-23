import React from 'react'
import { AGENT_RULE_MAX_LENGTH, AGENT_RULES_MAX_COUNT } from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import './AgentRulesEditor.css'

export interface AgentRulesEditorProps {
  rules: string[]
  disabled?: boolean
  onChange: (rules: string[]) => void
}

/** Lista editable de reglas del agente (+ para añadir, × para quitar). */
export const AgentRulesEditor: React.FC<AgentRulesEditorProps> = ({
  rules,
  disabled = false,
  onChange,
}) => {
  const { t } = useT()
  const canAdd = rules.length < AGENT_RULES_MAX_COUNT

  const updateAt = (index: number, value: string): void => {
    onChange(rules.map((rule, i) => (i === index ? value : rule)))
  }

  const removeAt = (index: number): void => {
    onChange(rules.filter((_, i) => i !== index))
  }

  const addRule = (): void => {
    if (!canAdd || disabled) return
    onChange([...rules, ''])
  }

  return (
    <div className="agent-rules-editor">
      <div className="agent-rules-editor__head">
        <span className="agent-rules-editor__label">{t('agentPane.rulesLabel')}</span>
        <button
          type="button"
          className="agent-rules-editor__add"
          disabled={disabled || !canAdd}
          title={t('agentPane.rulesAdd')}
          aria-label={t('agentPane.rulesAdd')}
          onClick={addRule}
        >
          <Icon name="plus" size={14} aria-hidden />
        </button>
      </div>
      <p className="agent-rules-editor__hint">{t('agentPane.rulesHint')}</p>
      {rules.length === 0 ? (
        <p className="agent-rules-editor__empty">{t('agentPane.rulesEmpty')}</p>
      ) : (
        <ul className="agent-rules-editor__list" aria-label={t('agentPane.rulesLabel')}>
          {rules.map((rule, index) => (
            <li key={index} className="agent-rules-editor__item">
              <span className="agent-rules-editor__index" aria-hidden="true">
                {index + 1}
              </span>
              <input
                type="text"
                className="agent-rules-editor__input"
                value={rule}
                maxLength={AGENT_RULE_MAX_LENGTH}
                disabled={disabled}
                placeholder={t('agentPane.rulesPlaceholder')}
                aria-label={t('agentPane.rulesItemLabel', { n: index + 1 })}
                onChange={event => updateAt(index, event.target.value)}
              />
              <button
                type="button"
                className="agent-rules-editor__remove"
                disabled={disabled}
                title={t('agentPane.rulesRemove')}
                aria-label={t('agentPane.rulesRemove')}
                onClick={() => removeAt(index)}
              >
                <Icon name="close" size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
