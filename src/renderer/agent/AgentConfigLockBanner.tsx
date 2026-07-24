import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui'
import './AgentConfigLockBanner.css'

export interface AgentConfigLockBannerProps {
  busy: boolean
  loopActive: boolean
  awaitingDelegations?: boolean
}

export const AgentConfigLockBanner: React.FC<AgentConfigLockBannerProps> = ({
  busy,
  loopActive,
  awaitingDelegations = false,
}) => {
  const { t } = useT()
  if (!busy && !loopActive && !awaitingDelegations) return null

  return (
    <div className="agent-config-lock-banner" role="status">
      <Icon name={loopActive ? 'repeat' : 'pause'} size={14} aria-hidden />
      <span>
        {loopActive
          ? t('agentPane.configLockedLoop')
          : t('agentPane.configLockedBusy')}
      </span>
    </div>
  )
}
