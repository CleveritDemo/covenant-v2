import React from 'react'
import { useT } from '@i18n/useT'

export const OnboardingStepWelcome: React.FC = () => {
  const { t } = useT()

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-welcome-title">
      <h3 className="onboarding__title" id="onboarding-welcome-title">
        {t('onboarding.welcomeTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.welcomeLead')}</p>
      <div className="onboarding__chain">
        <p className="onboarding__chain-label">{t('onboarding.welcomeChainLabel')}</p>
        <p className="onboarding__chain-value">{t('onboarding.welcomeChain')}</p>
      </div>
    </section>
  )
}
