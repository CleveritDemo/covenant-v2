import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubActionsRun, GitHubJob } from '@shared/githubActionsTypes'
import type { GitTarget } from '@shared/gitSessionTypes'
import { statusKind } from '@shared/githubRunTimeline'
import { useT } from '@i18n/useT'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { GitHubActionsJobList } from './GitHubActionsJobList'

/** Un run en marcha se repregunta mientras esté abierto; al terminar, para. */
const POLL_MS = 10_000

function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diffMs = Date.now() - t
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `hace ${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `hace ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 48) return `hace ${hr}h`
  const days = Math.round(hr / 24)
  return `hace ${days}d`
}

type JobsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; jobs: GitHubJob[] }
  | { status: 'error'; message: string }

interface GitHubActionsRunRowProps {
  run: GitHubActionsRun
  target: GitTarget
  onOpen: (url: string) => void
}

export const GitHubActionsRunRow: React.FC<GitHubActionsRunRowProps> = ({
  run,
  target,
  onOpen,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<JobsState>({ status: 'idle' })
  const targetRef = useRef(target)
  targetRef.current = target

  const kind = statusKind(run.status, run.conclusion)
  const label = run.conclusion ?? (kind === 'running' ? run.status.replace(/_/g, ' ') : run.status)
  const running = kind === 'running'

  const load = useCallback(async (): Promise<void> => {
    setJobs(prev => (prev.status === 'loaded' ? prev : { status: 'loading' }))
    try {
      const result = await window.api.githubRunJobs(targetRef.current, run.id)
      setJobs(
        result.ok
          ? { status: 'loaded', jobs: result.jobs }
          : { status: 'error', message: result.error ?? t('githubActions.jobsFailed') },
      )
    } catch (e) {
      setJobs({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [run.id, t])

  // Se pide al abrir, no al listar: diez runs abiertos serían diez llamadas por refresco.
  useEffect(() => {
    if (!open || jobs.status !== 'idle') return
    void load()
  }, [open, jobs.status, load])

  useEffect(() => {
    if (!open || !running) return
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [open, running, load])

  const failedJobs =
    jobs.status === 'loaded'
      ? jobs.jobs.filter(j => statusKind(j.status, j.conclusion) === 'failure').map(j => j.name)
      : []

  return (
    <div className={`gh-actions-run gh-actions-run--${kind}`}>
      <div className="gh-actions-run__head">
        <button
          type="button"
          className="gh-actions-run-row"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {/* El enlace a GitHub vive en el detalle: en 300px de ancho un segundo
              botón aquí empuja el meta a tres líneas. */}
          <span className={`gh-actions-run-row__dot gh-actions-run-row__dot--${kind}`} aria-hidden />
          <span className="gh-actions-run-row__body">
            <span className="gh-actions-run-row__title">{run.title}</span>
            <span className="gh-actions-run-row__meta">
              {run.headBranch && <span className="gh-actions-run-row__branch">{run.headBranch}</span>}
              {run.event && <span className="gh-actions-run-row__event">{run.event}</span>}
              <span className="gh-actions-run-row__time">
                {formatRelativeTime(run.updatedAt || run.createdAt)}
              </span>
            </span>
          </span>
          <span className={`gh-actions-run-row__status gh-actions-run-row__status--${kind}`}>
            {label}
          </span>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="gh-actions-run__detail">
          {jobs.status === 'loading' && (
            <div className="gh-actions-run__loading">
              <Spinner aria-label={t('githubActions.loadingJobs')} />
            </div>
          )}
          {jobs.status === 'error' && (
            <p className="gh-actions-run__error" role="alert">{jobs.message}</p>
          )}
          {jobs.status === 'loaded' && jobs.jobs.length === 0 && (
            <p className="gh-actions-run__empty">{t('githubActions.noJobs')}</p>
          )}
          {jobs.status === 'loaded' && jobs.jobs.length > 0 && (
            <GitHubActionsJobList
              jobs={jobs.jobs}
              initialOpen={failedJobs}
              onOpen={onOpen}
            />
          )}
          {run.url && (
            <button
              type="button"
              className="gh-actions-run__external"
              title={run.url}
              onClick={() => onOpen(run.url)}
            >
              <Icon name="arrow" size={11} aria-hidden />
              {t('githubActions.openOnGithub')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
