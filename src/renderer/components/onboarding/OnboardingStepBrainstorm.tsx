import React from 'react'
import { useT } from '@i18n/useT'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'

export interface OnboardingStepBrainstormProps {
  canOpenBrainstorm: boolean
  onOpenBrainstorm: () => void
}

const ROWS: ReadonlyArray<{
  badge: string
  labelKey:
    | 'onboarding.brainstormObjective'
    | 'onboarding.brainstormFormat'
    | 'onboarding.brainstormRounds'
    | 'onboarding.brainstormMinutes'
}> = [
  { badge: 'OBJ', labelKey: 'onboarding.brainstormObjective' },
  { badge: 'FMT', labelKey: 'onboarding.brainstormFormat' },
  { badge: 'RONDAS', labelKey: 'onboarding.brainstormRounds' },
  { badge: 'ACTA', labelKey: 'onboarding.brainstormMinutes' },
]

export const OnboardingStepBrainstorm: React.FC<OnboardingStepBrainstormProps> = ({
  canOpenBrainstorm,
  onOpenBrainstorm,
}) => {
  const { t } = useT()

  const openButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={onOpenBrainstorm}
      disabled={!canOpenBrainstorm}
    >
      <Icon name="users" />
      {t('onboarding.brainstormOpen')}
    </Button>
  )

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-brainstorm-title">
      <h3 className="onboarding__title" id="onboarding-brainstorm-title">
        {t('onboarding.brainstormTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.brainstormLead')}</p>
      <ul className="onboarding__roles">
        {ROWS.map(row => (
          <li key={row.labelKey} className="onboarding__role">
            <Badge variant="muted">{row.badge}</Badge>
            <span>{t(row.labelKey)}</span>
          </li>
        ))}
      </ul>
      <div className="onboarding__actions">
        {!canOpenBrainstorm ? (
          <Tooltip content={t('onboarding.brainstormNeedFolder')}>
            <span>{openButton}</span>
          </Tooltip>
        ) : (
          openButton
        )}
      </div>
    </section>
  )
}
