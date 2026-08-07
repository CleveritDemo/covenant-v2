import React from 'react'
import { AGENT_RULE_MAX_LENGTH, AGENT_RULES_MAX_COUNT } from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import './AgentRulesEditor.css'

export interface AgentRulesEditorProps {
  rules: string[]
  disabled?: boolean
  /** Solo actualiza el borrador local; no persiste. */
  onChange: (rules: string[]) => void
  /** Persistir al salir de un input de regla. */
  onCommit?: () => void
}

/**
 * Lista editable de reglas del agente.
 *
 * ponytail: reordenar con flechas en vez de arrastrar — funciona con teclado,
 * no necesita DnD y es la mitad de código. Si la lista crece a decenas de
 * reglas, ahí sí toca drag & drop.
 */
export const AgentRulesEditor: React.FC<AgentRulesEditorProps> = ({
  rules,
  disabled = false,
  onChange,
  onCommit,
}) => {
  const { t } = useT()
  const canAdd = rules.length < AGENT_RULES_MAX_COUNT

  const updateAt = (index: number, value: string): void => {
    if (disabled) return
    onChange(rules.map((rule, i) => (i === index ? value : rule)))
  }

  const removeAt = (index: number): void => {
    if (disabled) return
    onChange(rules.filter((_, i) => i !== index))
    onCommit?.()
  }

  const moveBy = (index: number, delta: number): void => {
    const target = index + delta
    if (disabled || target < 0 || target >= rules.length) return
    const next = [...rules]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
    onCommit?.()
  }

  const addRule = (): void => {
    if (!canAdd || disabled) return
    onChange([...rules, ''])
  }

  return (
    <div className="agent-rules-editor">
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
                onBlur={() => onCommit?.()}
              />
              <button
                type="button"
                className="agent-rules-editor__move"
                disabled={disabled || index === 0}
                aria-label={t('agentPane.rulesMoveUp')}
                onClick={() => moveBy(index, -1)}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                className="agent-rules-editor__move"
                disabled={disabled || index === rules.length - 1}
                aria-label={t('agentPane.rulesMoveDown')}
                onClick={() => moveBy(index, 1)}
              >
                <span aria-hidden="true">↓</span>
              </button>
              <button
                type="button"
                className="agent-rules-editor__remove"
                disabled={disabled}
                aria-label={t('agentPane.rulesRemove')}
                onClick={() => removeAt(index)}
              >
                <Icon name="close" size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="agent-rules-editor__add"
        disabled={disabled || !canAdd}
        onClick={addRule}
      >
        <Icon name="plus" size={13} aria-hidden />
        <span>{t('agentPane.rulesAdd')}</span>
        <span className="agent-rules-editor__count">
          {rules.length}/{AGENT_RULES_MAX_COUNT}
        </span>
      </button>
    </div>
  )
}
