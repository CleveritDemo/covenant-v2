import React from 'react'
import { useT } from '@i18n/useT'
import type { QueuedTurnPreview } from '@shared/queuedTurnPreview'
import './QueuedTurnPreviewLabel.css'

export type QueuedTurnPreviewRenderable = Exclude<QueuedTurnPreview, { kind: 'human' }>

function agentWithTag(label: string, instanceTag?: string): string {
  return instanceTag ? `${label} ${instanceTag}` : label
}

export function formatQueuedTurnPreviewText(
  preview: QueuedTurnPreviewRenderable,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (preview.kind === 'delegation_task') {
    return t('agentPane.queueDelegatedTask', {
      agent: agentWithTag(preview.agentLabel, preview.instanceTag),
    })
  }

  if (preview.kind === 'delegation_result') {
    const agent = agentWithTag(preview.agentLabel, preview.instanceTag)
    if (preview.status === 'ok' && preview.summarySnippet) {
      return t('agentPane.queueDelegationResultSummary', {
        agent,
        summary: preview.summarySnippet,
      })
    }
    if (preview.status === 'fail') {
      return t('agentPane.queueDelegationResultFail', { agent })
    }
    if (preview.status === 'aborted') {
      return t('agentPane.queueDelegationResultAborted', { agent })
    }
    return t('agentPane.queueDelegationResult', { agent })
  }

  const labels = preview.items.map(item => agentWithTag(item.agentLabel, item.instanceTag))
  const shown = labels.slice(0, 3)
  const agents = shown.join(', ') + (labels.length > 3 ? '…' : '')
  return t('agentPane.queueDelegationResultsBatch', {
    count: preview.items.length,
    agents,
  })
}

function renderAgentRef(agentLabel: string, instanceTag?: string): React.ReactNode {
  return agentWithTag(agentLabel, instanceTag)
}

function renderAroundAgent(
  template: string,
  agentLabel: string,
  instanceTag: string | undefined,
  marker = '\0',
): React.ReactNode {
  const parts = template.split(marker)
  if (parts.length < 2) return template
  return (
    <>
      {parts[0]}
      {renderAgentRef(agentLabel, instanceTag)}
      {parts.slice(1).join(marker)}
    </>
  )
}

export interface QueuedTurnPreviewLabelProps {
  preview: QueuedTurnPreviewRenderable
}

export const QueuedTurnPreviewLabel: React.FC<QueuedTurnPreviewLabelProps> = ({ preview }) => {
  const { t } = useT()

  if (preview.kind === 'delegation_results_batch') {
    return (
      <span className="queued-turn-preview">
        {formatQueuedTurnPreviewText(preview, t)}
      </span>
    )
  }

  if (preview.kind === 'delegation_task') {
    const template = t('agentPane.queueDelegatedTask', { agent: '\0' })
    return (
      <span className="queued-turn-preview">
        {renderAroundAgent(template, preview.agentLabel, preview.instanceTag)}
      </span>
    )
  }

  if (preview.status === 'ok' && preview.summarySnippet) {
    const template = t('agentPane.queueDelegationResultSummary', {
      agent: '\0',
      summary: preview.summarySnippet,
    })
    return (
      <span className="queued-turn-preview">
        {renderAroundAgent(template, preview.agentLabel, preview.instanceTag)}
      </span>
    )
  }

  const key = preview.status === 'fail'
    ? 'agentPane.queueDelegationResultFail'
    : preview.status === 'aborted'
      ? 'agentPane.queueDelegationResultAborted'
      : 'agentPane.queueDelegationResult'
  const template = t(key, { agent: '\0' })
  return (
    <span className="queued-turn-preview">
      {renderAroundAgent(template, preview.agentLabel, preview.instanceTag)}
    </span>
  )
}
