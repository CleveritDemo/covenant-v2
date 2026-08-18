import React from 'react'
import type { IssueMentionSourceId } from '@shared/issueMention'
import './IssueSourceBadge.css'

const SOURCE_LABEL: Record<IssueMentionSourceId, string> = {
  jira: 'Jira',
  github: 'GitHub',
}

export interface IssueSourceBadgeProps {
  source: IssueMentionSourceId
}

/** Origen de una fila de mención de issues: Jira o GitHub. */
export const IssueSourceBadge: React.FC<IssueSourceBadgeProps> = ({ source }) => (
  <span className={`issue-source-badge issue-source-badge--${source}`}>
    {SOURCE_LABEL[source]}
  </span>
)
