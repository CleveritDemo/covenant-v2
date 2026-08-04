import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { ChoiceCard, Icon } from '../components/ui'
import './AgentPane.css'

export interface AgentPickerCloneSource {
  paneId: string
  name: string
  provider: AgentCliProvider
}

interface Props {
  open: boolean
  /** Agentes de la pestaña para clonar configuración. */
  cloneSources?: AgentPickerCloneSource[]
  onSelect: (provider: AgentCliProvider) => void
  onClone?: (sourcePaneId: string) => void
  onClose: () => void
}

const PROVIDERS: {
  id: AgentCliProvider
  icon: 'bot' | 'sparkles' | 'code'
  titleKey: 'claude' | 'cursor' | 'copilot'
}[] = [
  { id: 'claude', icon: 'bot', titleKey: 'claude' },
  { id: 'cursor', icon: 'sparkles', titleKey: 'cursor' },
  { id: 'copilot', icon: 'code', titleKey: 'copilot' },
]

export const AgentProviderPickerModal: React.FC<Props> = ({
  open,
  cloneSources = [],
  onSelect,
  onClone,
  onClose,
}) => {
  const { t } = useT()
  const showClone = Boolean(onClone && cloneSources.length > 0)

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.pickerTitle')}
      size="sm"
      zIndex={860}
    >
      <p className="agent-provider-picker__description">{t('agentPane.pickerDescription')}</p>
      <div className="agent-provider-picker__options" role="list">
        {PROVIDERS.map(provider => (
          <ChoiceCard
            key={provider.id}
            role="listitem"
            icon={<Icon name={provider.icon} size={18} />}
            onClick={() => onSelect(provider.id)}
          >
            <strong>{t(`agentPane.${provider.titleKey}`)}</strong>
          </ChoiceCard>
        ))}
      </div>

      {showClone ? (
        <section className="agent-provider-picker__clone" aria-label={t('agentPane.pickerDuplicateSection')}>
          <h3 className="agent-provider-picker__clone-title">{t('agentPane.pickerDuplicateSection')}</h3>
          <p className="agent-provider-picker__clone-hint">{t('agentPane.pickerDuplicateHint')}</p>
          <div className="agent-provider-picker__options" role="list">
            {cloneSources.map(source => {
              const providerLabel = source.provider === 'cursor'
                ? t('agentPane.cursor')
                : source.provider === 'copilot'
                  ? t('agentPane.copilot')
                  : t('agentPane.claude')
              return (
                <ChoiceCard
                  key={source.paneId}
                  role="listitem"
                  icon={<Icon name="bot" size={18} />}
                  onClick={() => onClone?.(source.paneId)}
                >
                  <strong>{source.name.trim() || t('agentPane.pickerDuplicateUnnamed')}</strong>
                  <span className="agent-provider-picker__clone-meta">{providerLabel}</span>
                </ChoiceCard>
              )
            })}
          </div>
        </section>
      ) : null}
    </TerminalModal>
  )
}
