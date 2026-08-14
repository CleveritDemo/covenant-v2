import React from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../TerminalModal'
import { Button } from '../ui/Button'
import { OnboardingStepper } from './OnboardingStepper'
import { OnboardingStepWelcome } from './OnboardingStepWelcome'
import { OnboardingStepRequirements } from './OnboardingStepRequirements'
import { OnboardingStepFolder } from './OnboardingStepFolder'
import { OnboardingStepTeam } from './OnboardingStepTeam'
import { OnboardingStepFirstMessage } from './OnboardingStepFirstMessage'
import {
  ONBOARDING_STEP_COUNT,
  type OnboardingCliRow,
} from './onboardingTypes'
import './OnboardingModal.css'

export type { OnboardingCliRow }

export interface OnboardingModalProps {
  open: boolean
  stepIndex: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
  /** Paso requisitos */
  cliRows: OnboardingCliRow[]
  loading: boolean
  onRecheck: () => void
  /** Paso carpeta */
  folderPath: string | null
  onPickFolder: () => void
  /** Paso equipo */
  canCreateTeam: boolean
  teamCreated: boolean
  onCreateTeam: () => void
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onFinish,
  cliRows,
  loading,
  onRecheck,
  folderPath,
  onPickFolder,
  canCreateTeam,
  teamCreated,
  onCreateTeam,
}) => {
  const { t } = useT()
  const clamped = Math.min(Math.max(stepIndex, 0), ONBOARDING_STEP_COUNT - 1)
  const isFirst = clamped === 0
  const isLast = clamped === ONBOARDING_STEP_COUNT - 1

  let stepContent: React.ReactNode = null
  switch (clamped) {
    case 0:
      stepContent = <OnboardingStepWelcome />
      break
    case 1:
      stepContent = (
        <OnboardingStepRequirements
          rows={cliRows}
          loading={loading}
          onRecheck={onRecheck}
        />
      )
      break
    case 2:
      stepContent = (
        <OnboardingStepFolder folderPath={folderPath} onPickFolder={onPickFolder} />
      )
      break
    case 3:
      stepContent = (
        <OnboardingStepTeam
          canCreateTeam={canCreateTeam}
          teamCreated={teamCreated}
          onCreateTeam={onCreateTeam}
        />
      )
      break
    case 4:
      stepContent = <OnboardingStepFirstMessage onFinish={onFinish} />
      break
    default:
      stepContent = null
  }

  return (
    <TerminalModal
      open={open}
      onClose={onSkip}
      title={t('onboarding.title')}
      titleId="onboarding-modal-title"
      size="md"
      bodyLayout="spacious"
      closeOnEscape
      footer={(
        <>
          {!isFirst ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t('onboarding.back')}
            </Button>
          ) : null}
          <span className="onboarding__footer-spacer" />
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {t('onboarding.skip')}
          </Button>
          {!isLast ? (
            <Button variant="primary" size="sm" onClick={onNext}>
              {t('onboarding.next')}
            </Button>
          ) : null}
        </>
      )}
    >
      <div className="onboarding">
        <OnboardingStepper stepIndex={clamped} />
        {stepContent}
      </div>
    </TerminalModal>
  )
}
