import React from 'react'
import type { GitRepoStatus } from '@shared/gitSessionTypes'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'

interface GitBranchBadgeProps {
  status: GitRepoStatus
  /** Por defecto muestra la etiqueta «rama»; con `icon` solo ícono git-branch. */
  labelStyle?: 'text' | 'icon'
}

export const GitBranchBadge: React.FC<GitBranchBadgeProps> = ({ status, labelStyle = 'text' }) => {
  if (!status.isRepo) return null
  return (
    <div
      className={`git-branch-badge${labelStyle === 'icon' ? ' git-branch-badge--icon-label' : ''}`}
    >
      {labelStyle === 'icon' ? (
        <span className="git-branch-badge__icon-wrap" aria-hidden>
          <Icon name="git-branch" size={14} />
        </span>
      ) : (
        <span className="git-branch-badge__label">rama</span>
      )}
      <code className="git-branch-badge__name">{status.branch ?? '—'}</code>
      {status.upstream && (
        <span className="git-branch-badge__upstream">
          → <code>{status.upstream}</code>
        </span>
      )}
      {typeof status.ahead === 'number' && status.ahead > 0 && (
        <Badge variant="accent">{`+${status.ahead}`}</Badge>
      )}
      {typeof status.behind === 'number' && status.behind > 0 && (
        <Badge variant="muted">{`−${status.behind}`}</Badge>
      )}
    </div>
  )
}
