import React from 'react'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'

export interface OnboardingStepFirstMessageProps {
  onFinish: () => void
}

export const OnboardingStepFirstMessage: React.FC<OnboardingStepFirstMessageProps> = ({
  onFinish,
}) => {
  const { t } = useT()

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-first-title">
      <h3 className="onboarding__title" id="onboarding-first-title">
        {t('onboarding.firstMessageTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.firstMessageLead')}</p>
      <div className="onboarding__example">
        <p className="onboarding__example-label">{t('onboarding.firstMessageExampleLabel')}</p>
        <p className="onboarding__example-text">{t('onboarding.firstMessageExample')}</p>
      </div>
      <div className="onboarding__actions onboarding__actions--end">
        <Button variant="primary" size="sm" onClick={onFinish}>
          {t('onboarding.finish')}
        </Button>
      </div>
    </section>
  )
}
