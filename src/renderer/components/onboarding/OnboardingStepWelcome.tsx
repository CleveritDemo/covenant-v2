import React from 'react'
import { useT } from '@i18n/useT'
import type { OrchestratorPath } from '@shared/onboarding'
import { ChoiceCard } from '../ui'

export interface OnboardingStepWelcomeProps {
  path: OrchestratorPath | ''
  onSelectPath: (path: OrchestratorPath) => void
}

export const OnboardingStepWelcome: React.FC<OnboardingStepWelcomeProps> = ({
  path,
  onSelectPath,
}) => {
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
      <div className="onboarding__path" role="radiogroup" aria-label={t('onboarding.pathTitle')}>
        <p className="onboarding__path-title">{t('onboarding.pathTitle')}</p>
        <ChoiceCard
          role="radio"
          selected={path === 'business'}
          aria-checked={path === 'business'}
          onClick={() => onSelectPath('business')}
        >
          <strong>{t('onboarding.pathBusiness')}</strong>
          <span className="onboarding__path-hint">{t('onboarding.pathBusinessHint')}</span>
        </ChoiceCard>
        <ChoiceCard
          role="radio"
          selected={path === 'engineer'}
          aria-checked={path === 'engineer'}
          onClick={() => onSelectPath('engineer')}
        >
          <strong>{t('onboarding.pathEngineer')}</strong>
          <span className="onboarding__path-hint">{t('onboarding.pathEngineerHint')}</span>
        </ChoiceCard>
      </div>
    </section>
  )
}
