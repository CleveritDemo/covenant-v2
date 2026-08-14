import React from 'react'
import { useT } from '@i18n/useT'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'

export interface OnboardingStepTeamProps {
  canCreateTeam: boolean
  teamCreated: boolean
  onCreateTeam: () => void
}

const ROLES: ReadonlyArray<{ badge: string; labelKey: 'onboarding.teamRoleTl' | 'onboarding.teamRoleFrontend' | 'onboarding.teamRoleBackend' | 'onboarding.teamRoleQa' }> = [
  { badge: 'TL', labelKey: 'onboarding.teamRoleTl' },
  { badge: 'FE', labelKey: 'onboarding.teamRoleFrontend' },
  { badge: 'BE', labelKey: 'onboarding.teamRoleBackend' },
  { badge: 'QA', labelKey: 'onboarding.teamRoleQa' },
]

export const OnboardingStepTeam: React.FC<OnboardingStepTeamProps> = ({
  canCreateTeam,
  teamCreated,
  onCreateTeam,
}) => {
  const { t } = useT()

  const createButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={onCreateTeam}
      disabled={!canCreateTeam || teamCreated}
    >
      <Icon name="users" />
      {teamCreated ? t('onboarding.teamCreated') : t('onboarding.teamCreate')}
    </Button>
  )

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-team-title">
      <h3 className="onboarding__title" id="onboarding-team-title">
        {t('onboarding.teamTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.teamLead')}</p>
      <ul className="onboarding__roles">
        {ROLES.map(role => (
          <li key={role.labelKey} className="onboarding__role">
            <Badge variant="muted">{role.badge}</Badge>
            <span>{t(role.labelKey)}</span>
          </li>
        ))}
      </ul>
      <div className="onboarding__actions">
        {teamCreated ? (
          <Badge variant="accent">{t('onboarding.teamCreated')}</Badge>
        ) : !canCreateTeam ? (
          <Tooltip content={t('onboarding.teamNeedFolder')}>
            <span>{createButton}</span>
          </Tooltip>
        ) : (
          createButton
        )}
      </div>
    </section>
  )
}
