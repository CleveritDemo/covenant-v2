import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import './AgentPane.css'

interface Props {
  open: boolean
  onSelect: (provider: AgentCliProvider) => void
  onClose: () => void
}

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
      <div className="agent-provider-picker__options">
        <Button variant="secondary" onClick={() => onSelect('claude')}>
          <Icon name="bot" size={16} />
          {t('agentPane.claude')}
        </Button>
        <Button variant="secondary" onClick={() => onSelect('cursor')}>
          <Icon name="sparkles" size={16} />
          {t('agentPane.cursor')}
        </Button>
      </div>
    </TerminalModal>
  )
}

