import React from 'react'
import { useT } from '@i18n/useT'
import { Button, ChoiceCard } from '../components/ui'
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
        <ChoiceCard
          icon={<Icon name="brain" size={18} />}
          onClick={() => onSelectPath('business')}
        >
          <strong>{t('tabs.pathPlan')}</strong>
          <span className="plane-onboarding-home__hint">{t('tabs.pathPlanHint')}</span>
        </ChoiceCard>
        <ChoiceCard
          icon={<Icon name="orchestrator" size={18} />}
          onClick={() => onSelectPath('engineer')}
        >
          <strong>{t('tabs.pathExecute')}</strong>
          <span className="plane-onboarding-home__hint">{t('tabs.pathExecuteHint')}</span>
        </ChoiceCard>
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
