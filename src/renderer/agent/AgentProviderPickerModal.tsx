import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { AGENT_CLI_PROVIDER_IDS, agentCliSpec } from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { BrandIcon, ChoiceCard } from '../components/ui'
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
      size="lg"
      zIndex={860}
    >
      <p className="agent-provider-picker__description">{t('agentPane.pickerDescription')}</p>
      <div className="agent-provider-picker__options" role="list">
        {AGENT_CLI_PROVIDER_IDS.map(id => (
          <ChoiceCard
            key={id}
            role="listitem"
            icon={<BrandIcon provider={id} size={18} />}
            onClick={() => onSelect(id)}
          >
            <strong>{agentCliSpec(id).label}</strong>
          </ChoiceCard>
        ))}
      </div>

      {showClone ? (
        <section className="agent-provider-picker__clone" aria-label={t('agentPane.pickerDuplicateSection')}>
          <h3 className="agent-provider-picker__clone-title">{t('agentPane.pickerDuplicateSection')}</h3>
          <p className="agent-provider-picker__clone-hint">{t('agentPane.pickerDuplicateHint')}</p>
          <div className="agent-provider-picker__options" role="list">
            {cloneSources.map(source => {
              const providerLabel = agentCliSpec(source.provider).label
              return (
                <ChoiceCard
                  key={source.paneId}
                  role="listitem"
                  icon={<BrandIcon provider={source.provider} size={18} />}
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
