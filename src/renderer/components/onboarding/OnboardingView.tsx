import React from 'react'
import { useT } from '@i18n/useT'
import type { OrchestratorPath } from '@shared/onboarding'
import type { OnboardingStepId } from '@shared/onboardingSteps'
import { GravityHeroCanvas } from '../GravityHeroCanvas'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { OnboardingStepper } from './OnboardingStepper'
import { OnboardingStepWelcome } from './OnboardingStepWelcome'
import { OnboardingStepAccount } from './OnboardingStepAccount'
import { OnboardingStepRequirements } from './OnboardingStepRequirements'
import { OnboardingStepFolder } from './OnboardingStepFolder'
import { OnboardingStepTeam } from './OnboardingStepTeam'
import { OnboardingStepBrainstorm } from './OnboardingStepBrainstorm'
import { OnboardingStepFirstMessage } from './OnboardingStepFirstMessage'
import type { OnboardingCliRow } from './onboardingTypes'
import './OnboardingView.css'

export type { OnboardingCliRow }

export interface OnboardingViewProps {
  open: boolean
  stepIndex: number
  steps: OnboardingStepId[]
  path: OrchestratorPath | ''
  onSelectPath: (path: OrchestratorPath) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
  /** Paso requisitos */
  cliRows: OnboardingCliRow[]
  loading: boolean
  cliError: boolean
  onRecheck: () => void
  /** Paso carpeta */
  folderPath: string | null
  onPickFolder: () => void
  /** Paso equipo */
  canCreateTeam: boolean
  teamCreated: boolean
  onCreateTeam: () => void
  /** Paso brainstorm */
  canOpenBrainstorm: boolean
  onOpenBrainstorm: () => void
  /** Hay orgs: cerrar el wizard y abrir el picker de workspaces org. */
  onLoadOrgWorkspace: () => void
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  open,
  stepIndex,
  steps,
  path,
  onSelectPath,
  onNext,
  onBack,
  onSkip,
  onFinish,
  cliRows,
  loading,
  cliError,
  onRecheck,
  folderPath,
  onPickFolder,
  canCreateTeam,
  teamCreated,
  onCreateTeam,
  canOpenBrainstorm,
  onOpenBrainstorm,
  onLoadOrgWorkspace,
}) => {
  const { t } = useT()
  const lastIndex = Math.max(0, steps.length - 1)
  const clamped = Math.min(Math.max(stepIndex, 0), lastIndex)
  const isFirst = clamped === 0
  const isLast = clamped === lastIndex
  const stepId = steps[clamped]

  let stepContent: React.ReactNode = null
  switch (stepId) {
    case 'welcome':
      stepContent = <OnboardingStepWelcome path={path} onSelectPath={onSelectPath} />
      break
    case 'account':
      stepContent = (
        <OnboardingStepAccount
          onSkipAccount={onNext}
          onLoadOrgWorkspace={onLoadOrgWorkspace}
        />
      )
      break
    case 'requirements':
      stepContent = (
        <OnboardingStepRequirements
          rows={cliRows}
          loading={loading}
          error={cliError}
          onRecheck={onRecheck}
        />
      )
      break
    case 'folder':
      stepContent = (
        <OnboardingStepFolder folderPath={folderPath} onPickFolder={onPickFolder} />
      )
      break
    case 'team':
      stepContent = (
        <OnboardingStepTeam
          canCreateTeam={canCreateTeam}
          teamCreated={teamCreated}
          onCreateTeam={onCreateTeam}
        />
      )
      break
    case 'brainstorm':
      stepContent = (
        <OnboardingStepBrainstorm
          canOpenBrainstorm={canOpenBrainstorm}
          onOpenBrainstorm={onOpenBrainstorm}
        />
      )
      break
    case 'firstMessage':
      stepContent = <OnboardingStepFirstMessage onFinish={onFinish} />
      break
    default:
      stepContent = null
  }

  if (!open) return null

  return (
    <GravityHeroCanvas
      zIndex={940}
      role="dialog"
      aria-modal
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-view__panel">
        <h2 className="onboarding-view__title" id="onboarding-title">
          {t('onboarding.title')}
        </h2>
        <div className="onboarding">
          <OnboardingStepper steps={steps} stepIndex={clamped} />
          {stepContent}
        </div>
        <div className="onboarding-view__footer" data-testid="onboarding-footer">
          {!isFirst ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t('onboarding.back')}
            </Button>
          ) : null}
          <span className="onboarding__footer-spacer" />
          <Tooltip content={t('onboarding.skipHint')}>
            <span>
              <Button variant="ghost" size="sm" onClick={onSkip}>
                {t('onboarding.skip')}
              </Button>
            </span>
          </Tooltip>
          {!isLast && stepId !== 'account' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onNext}
              disabled={path === ''}
            >
              {t('onboarding.next')}
            </Button>
          ) : null}
        </div>
      </div>
    </GravityHeroCanvas>
  )
}
