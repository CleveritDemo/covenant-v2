import React from 'react'
import { useT } from '@i18n/useT'
import { Button, OptionRow } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import './PlaneOnboardingHome.css'

export interface PlaneOnboardingHomeProps {
  onSelectPath: (path: 'business' | 'engineer') => void
  onInviteToOrg?: () => void
}

/**
 * Casa del onboarding in-plane: dos caminos y la vía de invitación.
 * Solo lo monta PlaneIdleGravity mientras el path sigue vacío.
 */
export const PlaneOnboardingHome: React.FC<PlaneOnboardingHomeProps> = ({
  onSelectPath,
  onInviteToOrg,
}) => {
  const { t } = useT()

  return (
    <div className="plane-onboarding-home">
      <h2 className="plane-onboarding-home__heading">
        {t('tabs.onboardingChoosePath')}
      </h2>
      <div
        className="plane-onboarding-home__paths"
        role="group"
        data-onboarding="path-picker"
      >
        <OptionRow
          icon={<Icon name="brain" size={20} />}
          title={t('tabs.pathPlan')}
          hint={t('tabs.pathPlanHint')}
          onClick={() => onSelectPath('business')}
        />
        <OptionRow
          icon={<Icon name="orchestrator" size={20} />}
          title={t('tabs.pathExecute')}
          hint={t('tabs.pathExecuteHint')}
          onClick={() => onSelectPath('engineer')}
        />
      </div>
      {onInviteToOrg ? (
        <div className="plane-onboarding-home__invite">
          <Button variant="ghost" size="sm" onClick={onInviteToOrg}>
            {t('tabs.inviteTeam')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
