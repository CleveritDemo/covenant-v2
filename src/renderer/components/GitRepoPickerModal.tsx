import React from 'react'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
import { sessionCwdPaneLabel } from '../terminal/explorer/explorerPathUtils'
import { TerminalModal } from './TerminalModal'
import { ChoiceCard, Icon } from './ui'
import '../agent/AgentPane.css'

interface GitRepoPickerModalProps {
  open: boolean
  repos: GitListedRepo[]
  onSelect: (path: string) => void
  onClose: () => void
}

/** Selección de repo cuando hay más de uno (mismo patrón que AgentProviderPickerModal). */
export const GitRepoPickerModal: React.FC<GitRepoPickerModalProps> = ({
  open,
  repos,
  onSelect,
  onClose,
}) => {
  const { t } = useT()

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('git.reposPickerTitle')}
      size="sm"
      zIndex={860}
      closeOnBackdrop
    >
      <p className="agent-provider-picker__description">{t('git.reposPickerDescription')}</p>
      <div className="agent-provider-picker__options" role="list">
        {repos.map(repo => (
          <ChoiceCard
            key={repo.path}
            role="listitem"
            icon={<Icon name="git-branch" size={18} />}
            onClick={() => onSelect(repo.path)}
          >
            <strong>{sessionCwdPaneLabel(repo.path)}</strong>
          </ChoiceCard>
        ))}
      </div>
    </TerminalModal>
  )
}
