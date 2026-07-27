import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubActionsSnapshot } from '@shared/githubActionsTypes'
import type { GitRepoStatus, GitTarget } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { GitHubActionsRunRow } from './GitHubActionsRunRow'
import './GitHubActionsPanel.css'

interface GitHubActionsPanelProps {
  target: GitTarget
  repoStatus: GitRepoStatus | null
  refreshToken: number
}

export const GitHubActionsPanel: React.FC<GitHubActionsPanelProps> = ({
  target,
  repoStatus,
  refreshToken,
}) => {
  const { t } = useT()
  const [snapshot, setSnapshot] = useState<GitHubActionsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const targetKey = `${target.path ?? ''}|${target.sessionId ?? ''}`
  const targetRef = useRef(target)
  targetRef.current = target
  const isRepo = Boolean(repoStatus?.isRepo)

  const refresh = useCallback(async (): Promise<void> => {
    if (!isRepo) {
      setSnapshot(null)
      return
    }
    setLoading(true)
    try {
      const s = await window.api.githubActionsList(targetRef.current)
      setSnapshot(s)
    } catch (e) {
      setSnapshot({
        ok: false,
        repo: null,
        runs: [],
        error: e instanceof Error ? e.message : String(e),
        errorCode: 'api_failed',
      })
    } finally {
      setLoading(false)
    }
  }, [targetKey, isRepo])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshToken])

  const openUrl = useCallback((url: string): void => {
    void window.api.openExternalUrl(url)
  }, [])

  const actionsUrl =
    snapshot?.repo != null
      ? `https://github.com/${snapshot.repo.fullName}/actions`
      : null

  return (
    <aside className="gh-actions-panel" aria-label={t('githubActions.title')}>
      <header className="gh-actions-panel__header">
        <h3 className="gh-actions-panel__title">{t('githubActions.title')}</h3>
        <Button
          variant="secondary"
          size="sm"
          disabled={!repoStatus?.isRepo || loading}
          onClick={() => void refresh()}
        >
          {t('githubActions.refresh')}
        </Button>
      </header>

      <div className="gh-actions-panel__body">
        {!repoStatus?.isRepo && (
          <p className="gh-actions-panel__hint">{t('githubActions.notInRepo')}</p>
        )}

        {repoStatus?.isRepo && loading && !snapshot && (
          <div className="gh-actions-panel__loading">
            <Spinner aria-label={t('githubActions.loadingAriaLabel')} />
          </div>
        )}

        {repoStatus?.isRepo && snapshot && !snapshot.ok && (
          <div className="gh-actions-panel__error" role="alert">
            <p>{snapshot.error ?? t('githubActions.loadFailed')}</p>
            {snapshot.errorCode === 'token_missing' && (
              <p className="gh-actions-panel__error-hint">{t('githubActions.tokenMissingHint')}</p>
            )}
            {snapshot.errorCode === 'token_invalid' && (
              <p className="gh-actions-panel__error-hint">{t('githubActions.tokenInvalidHint')}</p>
            )}
            {snapshot.errorCode === 'not_github' && (
              <p className="gh-actions-panel__error-hint">{t('githubActions.notGithubHint')}</p>
            )}
          </div>
        )}

        {repoStatus?.isRepo && snapshot?.ok && snapshot.runs.length === 0 && (
          <p className="gh-actions-panel__hint">{t('githubActions.noRuns')}</p>
        )}

        {snapshot?.ok && snapshot.runs.length > 0 && (
          <ul className="gh-actions-panel__list">
            {snapshot.runs.map(run => (
              <li key={run.id}>
                <GitHubActionsRunRow run={run} onOpen={openUrl} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {actionsUrl && (
        <footer className="gh-actions-panel__footer">
          <button
            type="button"
            className="gh-actions-panel__link"
            onClick={() => void openUrl(actionsUrl)}
          >
            {t('githubActions.viewAll')}
          </button>
        </footer>
      )}
    </aside>
  )
}
