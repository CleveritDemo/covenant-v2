import React from 'react'
import { useT } from '@i18n/useT'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import type { OnboardingCliRow } from './onboardingTypes'

export interface OnboardingStepRequirementsProps {
  rows: OnboardingCliRow[]
  loading: boolean
  onRecheck: () => void
}

export const OnboardingStepRequirements: React.FC<OnboardingStepRequirementsProps> = ({
  rows,
  loading,
  onRecheck,
}) => {
  const { t } = useT()
  const noneInstalled = rows.length > 0 && rows.every(row => !row.installed)

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-requirements-title">
      <h3 className="onboarding__title" id="onboarding-requirements-title">
        {t('onboarding.requirementsTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.requirementsLead')}</p>

      {noneInstalled ? (
        <p className="onboarding__alert" role="status">
          {t('onboarding.requirementsNone')}
        </p>
      ) : null}

      {loading ? (
        <div className="onboarding__loading" role="status">
          <Spinner aria-label={t('onboarding.requirementsChecking')} />
          <span>{t('onboarding.requirementsChecking')}</span>
        </div>
      ) : (
        <ul className="onboarding__cli-list">
          {rows.map(row => (
            <li key={row.provider} className="onboarding__cli-row">
              <div className="onboarding__cli-main">
                <span className="onboarding__cli-label">{row.label}</span>
                <span className="onboarding__cli-command">
                  {t('onboarding.requirementsCommand', { command: row.command })}
                </span>
              </div>
              <div className="onboarding__cli-status">
                {row.installed && row.version ? (
                  <Badge variant="muted">
                    {t('onboarding.requirementsVersion', { version: row.version })}
                  </Badge>
                ) : null}
                <Badge variant={row.installed ? 'accent' : 'default'}>
                  {row.installed
                    ? t('onboarding.requirementsInstalled')
                    : t('onboarding.requirementsMissing')}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="onboarding__actions">
        <Button variant="secondary" size="sm" onClick={onRecheck} disabled={loading}>
          {t('onboarding.requirementsRecheck')}
        </Button>
      </div>
    </section>
  )
}
