import React from 'react'
import { useT } from '@i18n/useT'
import type { OnboardingStepId } from '@shared/onboardingSteps'

export interface OnboardingStepperProps {
  steps: OnboardingStepId[]
  stepIndex: number
}

const STEP_LABEL_KEYS = {
  welcome: 'onboarding.stepWelcome',
  account: 'onboarding.stepAccount',
  requirements: 'onboarding.stepRequirements',
  folder: 'onboarding.stepFolder',
  team: 'onboarding.stepTeam',
  brainstorm: 'onboarding.stepBrainstorm',
  firstMessage: 'onboarding.stepFirstMessage',
} as const satisfies Record<OnboardingStepId, string>

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({ steps, stepIndex }) => {
  const { t } = useT()
  const lastIndex = Math.max(0, steps.length - 1)
  const clamped = Math.min(Math.max(stepIndex, 0), lastIndex)
  const current = clamped + 1
  const stepId = steps[clamped]
  const labelKey = stepId ? STEP_LABEL_KEYS[stepId] : STEP_LABEL_KEYS.welcome

  return (
    <div className="onboarding__stepper">
      <div className="onboarding__step-labels">
        <p className="onboarding__step-meta" aria-live="polite">
          {t('onboarding.stepOf', { current, total: steps.length })}
        </p>
        <p className="onboarding__step-name">{t(labelKey)}</p>
      </div>
      <ol className="onboarding__dots" aria-hidden="true">
        {steps.map((id, i) => {
          const state = i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''
          return (
            <li
              key={id}
              className={['onboarding__dot', state].filter(Boolean).join(' ')}
            />
          )
        })}
      </ol>
    </div>
  )
}
