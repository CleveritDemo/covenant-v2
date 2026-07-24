import React from 'react'
import { useT } from '@i18n/useT'
import { Input } from '../components/ui'
import './AgentConfigSlugField.css'

export interface AgentConfigSlugFieldProps {
  value: string
  locked: boolean
  onChange: (value: string) => void
  onCommit: () => void
}

/** Campo del slug de archivo `.iaterminal/agents/<slug>.json`. */
export const AgentConfigSlugField: React.FC<AgentConfigSlugFieldProps> = ({
  value,
  locked,
  onChange,
  onCommit,
}) => {
  const { t } = useT()
  const preview = value.trim() || 'agent'

  return (
    <label className="agent-config-slug-field">
      <span className="agent-config-slug-field__label">{t('agentPane.slugLabel')}</span>
      <Input
        type="text"
        value={value}
        maxLength={64}
        disabled={locked}
        spellCheck={false}
        autoComplete="off"
        placeholder={t('agentPane.slugPlaceholder')}
        onChange={event => onChange(event.target.value)}
        onBlur={onCommit}
      />
      <span className="agent-config-slug-field__hint">
        {t('agentPane.slugHint', { file: `.iaterminal/agents/${preview}.json` })}
      </span>
    </label>
  )
}
