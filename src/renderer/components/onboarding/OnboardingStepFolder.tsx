import React from 'react'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export interface OnboardingStepFolderProps {
  folderPath: string | null
  onPickFolder: () => void
}

export const OnboardingStepFolder: React.FC<OnboardingStepFolderProps> = ({
  folderPath,
  onPickFolder,
}) => {
  const { t } = useT()
  const hasFolder = Boolean(folderPath)

  return (
    <section className="onboarding__body" aria-labelledby="onboarding-folder-title">
      <h3 className="onboarding__title" id="onboarding-folder-title">
        {t('onboarding.folderTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.folderLead')}</p>
      <p
        className={['onboarding__folder-path', hasFolder ? '' : 'is-empty'].filter(Boolean).join(' ')}
      >
        {hasFolder ? folderPath : t('onboarding.folderNone')}
      </p>
      <div className="onboarding__actions">
        <Button variant="primary" size="sm" onClick={onPickFolder}>
          <Icon name="folder" />
          {hasFolder ? t('onboarding.folderChange') : t('onboarding.folderPick')}
        </Button>
      </div>
    </section>
  )
}
