import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { GitCommandResult, GitRepoStatus, GitTarget } from '@shared/gitSessionTypes'
import { suggestGitCommitMessage, aiOptionsFromConfig } from '@ai/aiClient'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { TextArea } from './ui/TextArea'
import { Spinner } from './ui/Spinner'
import { Icon } from './ui/Icon'
import { GitBranchBadge } from './git/GitBranchBadge'
import { GitFileList } from './git/GitFileList'
import { GitHubActionsPanel } from './git/GitHubActionsPanel'
import { formatGitCommandResult } from './git/gitErrorI18n'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import './GitPanelModal.css'

interface GitPanelModalProps {
  open: boolean
  target: GitTarget
  config: AppConfig
  onClose: () => void
}

export const GitPanelModal: React.FC<GitPanelModalProps> = ({
  open,
  target,
  config,
  onClose,
}) => {
  const { t } = useT()
  const [status, setStatus] = useState<GitRepoStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastLog, setLastLog] = useState('')
  const [commitMsg, setCommitMsg] = useState('')
  const [actionsRefreshToken, setActionsRefreshToken] = useState(0)
  const aiAbortRef = useRef<AbortController | null>(null)
  const targetKey = `${target.path ?? ''}|${target.sessionId ?? ''}`
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort()
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const s = await window.api.gitStatus(targetRef.current)
      setStatus(s)
    } catch (e) {
      setStatus({
        isRepo: false,
        sessionCwd: '',
        files: [],
        hasStaged: false,
        hasUnstaged: false,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [targetKey])

  const refreshAll = useCallback((): void => {
    void refresh()
    setActionsRefreshToken(n => n + 1)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setCommitMsg('')
    setLastLog('')
    setActionsRefreshToken(n => n + 1)
    void refresh()
    // Solo al abrir o cambiar de repo: no re-ejecutar por identidad de callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh/refreshAll recreados por renders padre
  }, [open, targetKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      const accel = e.metaKey || e.ctrlKey
      if (!accel || e.altKey || e.shiftKey) return
      const isGit = e.key === 'g' || e.key === 'G' || e.code === 'KeyG'
      if (!isGit) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const runAndLog = useCallback(
    async (label: string, fn: () => Promise<GitCommandResult>): Promise<void> => {
      setBusy(label)
      try {
        const r = await fn()
        setLastLog(formatGitCommandResult(t, label, r))
        await refresh()
      } catch (e) {
        setLastLog(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusy(null)
      }
    },
    [refresh, t],
  )

  const onStageFile = useCallback(
    (relPath: string): void => {
      void runAndLog(`git add ${relPath}`, () => window.api.gitStageFile(targetRef.current, relPath))
    },
    [runAndLog],
  )

  const onUnstageFile = useCallback(
    (relPath: string): void => {
      void runAndLog(`git restore --staged ${relPath}`, () => window.api.gitUnstageFile(targetRef.current, relPath))
    },
    [runAndLog],
  )

  const onStageAll = useCallback((): void => {
    void runAndLog('git add -A', () => window.api.gitStageAll(targetRef.current))
  }, [runAndLog])

  const onUnstageAll = useCallback((): void => {
    void runAndLog('git restore --staged .', () => window.api.gitUnstageAll(targetRef.current))
  }, [runAndLog])

  const onPull = (): void => {
    void runAndLog('git pull', () => window.api.gitPull(targetRef.current))
  }

  const onPush = (): void => {
    void runAndLog('git push', () => window.api.gitPush(targetRef.current))
  }

  const onCommit = (): void => {
    const msg = commitMsg.trim()
    if (!msg) {
      setLastLog(t('git.emptyMessageError'))
      return
    }
    void (async (): Promise<void> => {
      await runAndLog('git commit', () => window.api.gitCommit(targetRef.current, msg))
      setCommitMsg('')
    })()
  }

  const onSuggestAi = (): void => {
    aiAbortRef.current?.abort()
    const ctrl = new AbortController()
    aiAbortRef.current = ctrl
    setBusy('ai-suggest')
    setLastLog('')
    void (async (): Promise<void> => {
      try {
        const diff = await window.api.gitDiffForAi(targetRef.current)
        if (!diff.ok) {
          setLastLog(diff.error ?? t('git.diffError'))
          return
        }
        const suggestion = await suggestGitCommitMessage(
          diff.text,
          aiOptionsFromConfig(config, { signal: ctrl.signal }),
        )
        setCommitMsg(suggestion)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setLastLog(`IA: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (aiAbortRef.current === ctrl) aiAbortRef.current = null
        setBusy(null)
      }
    })()
  }

  const repo = status?.isRepo === true
  const idle = !busy && !loading
  const canCommit =
    repo && status && status.hasStaged && commitMsg.trim().length > 0 && idle

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={t('git.title')}
        titleId="git-panel-title"
        size="xxl"
        bodyLayout="flush"
        zIndex={APP_OVERLAY_MODAL_Z}
        closeOnBackdrop
        footer={
          <span className="git-panel-footer-hint">
            {t('git.footerHint')}
          </span>
        }
      >
        <div className="git-panel-layout">
          <div className="git-panel-layout__main">
            <div className="git-panel-scroll">
              {loading && !status && (
                <div className="git-panel-loading">
                  <Spinner aria-label={t('git.loadingAriaLabel')} />
                </div>
              )}

              {status && (
                <>
                  <div className="git-panel-top-bar">
                    <div className="git-panel-top-bar__lead">
                      <div
                        className="git-panel-top-bar__cwd"
                        title={t('git.cwdTooltip', { cwd: status.sessionCwd || '—' })}
                      >
                        <span className="git-panel-top-bar__cwd-icon" aria-hidden>
                          <Icon name="folder-filled" size={14} />
                        </span>
                        <code className="git-panel-top-bar__cwd-path">{status.sessionCwd || '—'}</code>
                      </div>
                      {status.isRepo && (
                        <div className="git-panel-top-bar__branch">
                          <GitBranchBadge status={status} labelStyle="icon" />
                        </div>
                      )}
                    </div>
                    <div className="git-panel-top-bar__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!repo || !idle}
                        onClick={refreshAll}
                      >
                        {t('git.refreshButton')}
                      </Button>
                      <Button variant="secondary" size="sm" disabled={!repo || !idle} onClick={onPull}>
                        {t('git.pullButton')}
                      </Button>
                    </div>
                  </div>

                  {status.isRepo && status.repoRoot && status.repoRoot !== status.sessionCwd && (
                    <div className="git-panel-meta git-panel-meta--extra">
                      <span className="git-panel-meta__label">{t('git.repoRootLabel')}</span>
                      <code className="git-panel-meta__path">{status.repoRoot}</code>
                    </div>
                  )}

                  {!status.isRepo && (
                    <p className="git-panel-not-repo" role="alert">
                      {status.errorCode
                        ? t(`git.errors.${status.errorCode}` as 'git.errors.CWD_INVALID')
                        : (status.error ?? t('git.notGitRepo'))}
                    </p>
                  )}

                  {status.isRepo && (
                    <GitFileList
                      files={status.files}
                      unstagedNumStat={status.diffNumStat ?? ''}
                      stagedNumStat={status.stagedDiffNumStat ?? ''}
                      idle={idle}
                      onStageFile={onStageFile}
                      onUnstageFile={onUnstageFile}
                      onStageAll={onStageAll}
                      onUnstageAll={onUnstageAll}
                    />
                  )}

                  {repo && status && (
                    <div className="git-panel-commit">
                      <h3 className="git-panel-section-title">{t('git.commitTitle')}</h3>
                      <p className="git-panel-commit-hint">
                        {t('git.commitHint')}
                        {!status.hasStaged && t('git.nothingStaged')}
                      </p>
                      <div className="git-panel-commit-row">
                        <Button variant="ghost" size="sm" disabled={!idle} onClick={onSuggestAi}>
                          {busy === 'ai-suggest' ? (
                            <Spinner aria-label={t('git.suggestingAriaLabel')} />
                          ) : (
                            <span className="git-panel-ia-suggest-inner">
                              <Icon name="sparkles" size={14} aria-hidden />
                              <span>{t('git.suggestButton')}</span>
                            </span>
                          )}
                        </Button>
                      </div>
                      <TextArea
                        size="md"
                        rows={2}
                        placeholder={t('git.commitPlaceholder')}
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                        spellCheck
                      />
                      <Button variant="primary" size="sm" disabled={!canCommit} onClick={onCommit}>
                        {t('git.commitButton')}
                      </Button>
                      <div className="git-panel-push-row">
                        <Button variant="secondary" size="sm" disabled={!repo || !idle} onClick={onPush}>
                          {t('git.pushButton')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {lastLog.trim().length > 0 && (
                    <pre className="git-panel-log" role="log">{lastLog}</pre>
                  )}
                </>
              )}
            </div>
          </div>
          <GitHubActionsPanel
            target={target}
            repoStatus={status}
            refreshToken={actionsRefreshToken}
          />
        </div>
      </TerminalModal>
    </>
  )
}
