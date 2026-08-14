import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui'
import './AgentConfigLockBanner.css'

export interface AgentConfigLockBannerProps {
  busy: boolean
  awaitingDelegations?: boolean
}

export const AgentConfigLockBanner: React.FC<AgentConfigLockBannerProps> = ({
  busy,
  awaitingDelegations = false,
}) => {
  const { t } = useT()
  if (!busy && !awaitingDelegations) return null

  return (
    <div className="agent-config-lock-banner" role="status">
      <Icon name="pause" size={14} aria-hidden />
      <span>{t('agentPane.configLockedBusy')}</span>
    </div>
  )
}
