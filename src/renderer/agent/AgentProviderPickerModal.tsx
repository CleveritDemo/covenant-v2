import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { ChoiceCard, Icon } from '../components/ui'
import './AgentPane.css'

interface Props {
  open: boolean
  onSelect: (provider: AgentCliProvider) => void
  onClose: () => void
}

const PROVIDERS: { id: AgentCliProvider; icon: 'bot' | 'sparkles'; titleKey: 'claude' | 'cursor' }[] = [
  { id: 'claude', icon: 'bot', titleKey: 'claude' },
  { id: 'cursor', icon: 'sparkles', titleKey: 'cursor' },
]

export const AgentProviderPickerModal: React.FC<Props> = ({ open, onSelect, onClose }) => {
  const { t } = useT()
  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.pickerTitle')}
      size="sm"
      zIndex={760}
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
    </TerminalModal>
  )
}
