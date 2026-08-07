import React, { useState } from 'react'
import type { GitHubJob } from '@shared/githubActionsTypes'
import {
  durationSeconds,
  foldScaffoldSteps,
  formatDuration,
  runTimeline,
  statusKind,
} from '@shared/githubRunTimeline'
import { useT } from '@i18n/useT'
import { Icon } from '../ui/Icon'

interface GitHubActionsJobListProps {
  jobs: GitHubJob[]
  /** Jobs abiertos al montar: el que falló, para no cobrar tres clics por un error. */
  initialOpen: string[]
  onOpen: (url: string) => void
}

export const GitHubActionsJobList: React.FC<GitHubActionsJobListProps> = ({
  jobs,
  initialOpen,
  onOpen,
}) => {
  const { t } = useT()
  const [openJobs, setOpenJobs] = useState<string[]>(initialOpen)
  const [expandedScaffold, setExpandedScaffold] = useState<string[]>([])

  const timeline = runTimeline(jobs)
  const parallel = timeline.totalJobSeconds - timeline.spanSeconds

  const toggle = (list: string[], name: string): string[] =>
    list.includes(name) ? list.filter(n => n !== name) : [...list, name]

  return (
    <div className="gh-jobs">
      {timeline.lanes.map(({ job, offsetPct, widthPct, seconds }) => {
        const kind = statusKind(job.status, job.conclusion)
        const isOpen = openJobs.includes(job.name)
        const folded = foldScaffoldSteps(job.steps, {
          expanded: expandedScaffold.includes(job.name),
        })

        return (
          <div className="gh-job" key={job.id || job.name}>
            <button
              type="button"
              className="gh-job__head"
              aria-expanded={isOpen}
              onClick={() => setOpenJobs(prev => toggle(prev, job.name))}
            >
              <span className={`gh-job__dot gh-job__dot--${kind}`} aria-hidden />
              <span className="gh-job__name">{job.name}</span>
              <span className="gh-job__track">
                <span
                  className={`gh-job__bar gh-job__bar--${kind}`}
                  style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                />
              </span>
              <span className="gh-job__dur">{formatDuration(seconds)}</span>
            </button>

            {isOpen && (
              <div className="gh-job__steps">
                {folded.foldedCount > 0 && (
                  <button
                    type="button"
                    className="gh-step gh-step--fold"
                    onClick={() => setExpandedScaffold(prev => toggle(prev, job.name))}
                  >
                    <span className="gh-step__mark" aria-hidden>›</span>
                    <span className="gh-step__name">
                      {t('githubActions.scaffoldSteps', { count: folded.foldedCount })}
                    </span>
                    <span className="gh-step__dur">{formatDuration(folded.foldedSeconds)}</span>
                  </button>
                )}

                {folded.visible.map(step => {
                  const stepKind = statusKind(step.status, step.conclusion)
                  const stepSeconds = durationSeconds(step.startedAt, step.completedAt)
                  const slow = step.name === folded.slowestName
                  return (
                    <div
                      key={`${step.number}-${step.name}`}
                      className={[
                        'gh-step',
                        stepKind === 'failure' ? 'gh-step--failed' : '',
                        slow ? 'gh-step--slow' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className={`gh-step__mark gh-step__mark--${stepKind}`} aria-hidden>
                        {stepKind === 'failure' ? '✕' : stepKind === 'running' ? '·' : '✓'}
                      </span>
                      <span className="gh-step__name">{step.name}</span>
                      <span className="gh-step__dur">{formatDuration(stepSeconds)}</span>
                    </div>
                  )
                })}

                {job.url && (
                  <button
                    type="button"
                    className="gh-job__logs"
                    onClick={() => onOpen(job.url)}
                  >
                    <Icon name="code" size={11} aria-hidden />
                    {t('githubActions.viewLogs')}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Sólo vale la pena decirlo cuando el paralelismo ahorra algo real. */}
      {parallel > 30 && (
        <p className="gh-jobs__summary">
          {t('githubActions.wallClock', {
            wall: formatDuration(timeline.spanSeconds),
            total: formatDuration(timeline.totalJobSeconds),
          })}
        </p>
      )}
    </div>
  )
}
