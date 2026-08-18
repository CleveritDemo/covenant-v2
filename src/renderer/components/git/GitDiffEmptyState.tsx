import React from 'react'
import { Icon, type IconName } from '../ui/Icon'
import './GitDiffEmptyState.css'

export interface GitDiffEmptyStateProps {
  icon: IconName
  title: string
  hint?: string
  tone?: 'default' | 'error'
}

export const GitDiffEmptyState: React.FC<GitDiffEmptyStateProps> = ({
  icon,
  title,
  hint,
  tone = 'default',
}) => (
  <div
    className={tone === 'error' ? 'git-diff-empty git-diff-empty--error' : 'git-diff-empty'}
    role="status"
  >
    <span className="git-diff-empty__icon">
      <Icon name={icon} size={40} aria-hidden />
    </span>
    <p className="git-diff-empty__title">{title}</p>
    {hint ? <p className="git-diff-empty__hint">{hint}</p> : null}
  </div>
)
