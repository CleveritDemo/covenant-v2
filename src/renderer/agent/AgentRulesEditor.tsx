import React, { useState } from 'react'
import { AGENT_RULE_MAX_LENGTH, AGENT_RULES_MAX_COUNT } from '@shared/agentIdentity'
import { applyPastedRules, splitPastedRules } from '@shared/agentRulesPaste'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Toggle } from '../components/ui/Toggle'
import './AgentRulesEditor.css'

export interface AgentRulesEditorProps {
  rules: string[]
  rulesEnabled: boolean[]
  disabled?: boolean
  /** Solo actualiza el borrador local; no persiste. */
  onChange: (rules: string[], rulesEnabled: boolean[]) => void
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
  rulesEnabled,
  disabled = false,
  onChange,
  onCommit,
}) => {
  const { t } = useT()
  const canAdd = rules.length < AGENT_RULES_MAX_COUNT
  const [dropped, setDropped] = useState(0)

  const updateAt = (index: number, value: string): void => {
    if (disabled) return
    onChange(
      rules.map((rule, i) => (i === index ? value : rule)),
      rulesEnabled,
    )
  }

  const toggleAt = (index: number, checked: boolean): void => {
    if (disabled) return
    onChange(
      rules,
      rulesEnabled.map((flag, i) => (i === index ? checked : flag)),
    )
    onCommit?.()
  }

  const removeAt = (index: number): void => {
    if (disabled) return
    setDropped(0)
    onChange(
      rules.filter((_, i) => i !== index),
      rulesEnabled.filter((_, i) => i !== index),
    )
    onCommit?.()
  }

  const moveBy = (index: number, delta: number): void => {
    const target = index + delta
    if (disabled || target < 0 || target >= rules.length) return
    const nextRules = [...rules]
    const nextEnabled = [...rulesEnabled]
    const [movedRule] = nextRules.splice(index, 1)
    const [movedFlag] = nextEnabled.splice(index, 1)
    nextRules.splice(target, 0, movedRule)
    nextEnabled.splice(target, 0, movedFlag)
    onChange(nextRules, nextEnabled)
    onCommit?.()
  }

  const addRule = (): void => {
    if (!canAdd || disabled) return
    setDropped(0)
    onChange([...rules, ''], [...rulesEnabled, true])
  }

  const pasteAt = (index: number, event: React.ClipboardEvent<HTMLInputElement>): void => {
    if (disabled) return
    setDropped(0)
    const text = event.clipboardData.getData('text')
    const lines = splitPastedRules(text)
    if (lines.length < 2) return
    event.preventDefault()
    const target = event.currentTarget
    const value = target.value
    const before = value.slice(0, target.selectionStart ?? value.length)
    const after = value.slice(target.selectionEnd ?? value.length)
    const next = applyPastedRules({
      rules,
      rulesEnabled,
      index,
      before,
      after,
      lines,
    })
    onChange(next.rules, next.rulesEnabled)
    onCommit?.()
    setDropped(next.dropped)
  }

  return (
    <div className="agent-rules-editor">
      <p className="agent-rules-editor__hint">{t('agentPane.rulesHint')}</p>
      <p className="agent-rules-editor__hint agent-rules-editor__hint--sub">{t('agentPane.rulesDisabledHint')}</p>
      <p className="agent-rules-editor__hint agent-rules-editor__hint--sub">{t('agentPane.rulesPasteHint')}</p>

      {rules.length === 0 ? (
        <p className="agent-rules-editor__empty">{t('agentPane.rulesEmpty')}</p>
      ) : (
        <ul className="agent-rules-editor__list" aria-label={t('agentPane.rulesLabel')}>
          {rules.map((rule, index) => {
            const enabled = rulesEnabled[index] ?? true
            return (
            <li
              key={index}
              className={[
                'agent-rules-editor__item',
                enabled ? '' : 'agent-rules-editor__item--off',
              ].filter(Boolean).join(' ')}
            >
              <Toggle
                compact
                checked={enabled}
                disabled={disabled}
                label={t('agentPane.rulesToggleLabel')}
                onChange={checked => toggleAt(index, checked)}
              />
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
                onPaste={event => pasteAt(index, event)}
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
            )
          })}
        </ul>
      )}

      {dropped > 0 ? (
        <p className="agent-rules-editor__notice">
          {t('agentPane.rulesPasteTruncated', { n: dropped, max: AGENT_RULES_MAX_COUNT })}
        </p>
      ) : null}

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
