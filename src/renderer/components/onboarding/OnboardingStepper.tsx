import React from 'react'
import { useT } from '@i18n/useT'
import { ONBOARDING_STEP_COUNT } from './onboardingTypes'

export interface OnboardingStepperProps {
  stepIndex: number
}

const STEP_LABEL_KEYS = [
  'onboarding.stepWelcome',
  'onboarding.stepRequirements',
  'onboarding.stepFolder',
  'onboarding.stepTeam',
  'onboarding.stepBrainstorm',
  'onboarding.stepFirstMessage',
] as const

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({ stepIndex }) => {
  const { t } = useT()
  const clamped = Math.min(Math.max(stepIndex, 0), ONBOARDING_STEP_COUNT - 1)
  const current = clamped + 1

  return (
    <div className="onboarding__stepper">
      <div className="onboarding__step-labels">
        <p className="onboarding__step-meta" aria-live="polite">
          {t('onboarding.stepOf', { current, total: ONBOARDING_STEP_COUNT })}
        </p>
        <p className="onboarding__step-name">{t(STEP_LABEL_KEYS[clamped])}</p>
      </div>
      <ol className="onboarding__dots" aria-hidden="true">
        {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => {
          const state = i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''
          return (
            <li
              key={i}
              className={['onboarding__dot', state].filter(Boolean).join(' ')}
            />
          )
        })}
      </ol>
    </div>
  )
}
