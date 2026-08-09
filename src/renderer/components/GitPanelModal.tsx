import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppConfig } from '@shared/configSchema'
import type { GitCommandResult, GitRepoStatus, GitTarget } from '@shared/gitSessionTypes'
import type { GitWorktreeEntry } from '@shared/gitWorktree'
import { suggestGitCommitMessage, aiOptionsFromConfig } from '@ai/aiClient'
import { useT } from '@i18n/useT'
import { shortcutLabel } from '@i18n/modKeyLabel'
import { TerminalModal } from './TerminalModal'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { Button } from './ui/Button'
import { TextArea } from './ui/TextArea'
import { Spinner } from './ui/Spinner'
import { SegmentedControl } from './ui/SegmentedControl'
import { Select } from './ui/Select'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'
import { GitBranchBadge } from './git/GitBranchBadge'
import { GitFileList } from './git/GitFileList'
import { GitHubActionsPanel } from './git/GitHubActionsPanel'
import { GitDiffPane, type GitDiffSelection } from './git/GitDiffPane'
import { formatGitCommandResult } from './git/gitErrorI18n'
import { splitGitFilesByArea } from './git/gitPathUtils'
import { gitWorktreeOptions } from './git/gitWorktreeOptions'
import { gitAreaTotals, parseGitNumStat } from './git/gitDiffNumStat'
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
  const [lastRun, setLastRun] = useState<{ label: string; ok: boolean } | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [actionsRefreshToken, setActionsRefreshToken] = useState(0)
  // El panel de Actions avisa si el remoto no es de GitHub; entonces sobra la columna.
  const [actionsAvailable, setActionsAvailable] = useState(true)
  const [sideTab, setSideTab] = useState<'diff' | 'actions'>('diff')
  // Sube con cada gitStatus: el diff visible se recarga tras stage/unstage/descartar.
  const [statusToken, setStatusToken] = useState(0)
  const [selection, setSelection] = useState<GitDiffSelection | null>(null)
  const [discardTarget, setDiscardTarget] = useState<{ path: string; untracked: boolean } | null>(
    null,
  )
  const aiAbortRef = useRef<AbortController | null>(null)
  // Worktrees del repo: inspeccionar el diff de otro sin mover la pestaña.
  const [worktrees, setWorktrees] = useState<GitWorktreeEntry[]>([])
  const [worktreePath, setWorktreePath] = useState('')
  const propKey = `${target.path ?? ''}|${target.sessionId ?? ''}`
  const effectiveTarget = useMemo<GitTarget>(
    () => (worktreePath ? { path: worktreePath } : target),
    [worktreePath, propKey], // eslint-disable-line react-hooks/exhaustive-deps -- target por valor
  )
  const targetKey = worktreePath || propKey
  const targetRef = useRef(effectiveTarget)
  targetRef.current = effectiveTarget

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
      setStatusToken(n => n + 1)
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

  // Lista de worktrees: se recarga al abrir y al cambiar de repo (no en cada switch).
  useEffect(() => {
    if (!open) return
    setWorktreePath('')
    let alive = true
    void window.api
      .gitWorktreeList(target)
      .then(list => { if (alive) setWorktrees(list) })
      .catch(() => { if (alive) setWorktrees([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target por valor
  }, [open, propKey])

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setCommitMsg('')
    setLastLog('')
    setLastRun(null)
    setActionsAvailable(true)
    setSelection(null)
    setDiscardTarget(null)
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
    async (label: string, fn: () => Promise<GitCommandResult>): Promise<boolean> => {
      setBusy(label)
      try {
        const r = await fn()
        setLastLog(formatGitCommandResult(t, label, r))
        setLastRun({ label, ok: r.ok })
        await refresh()
        return r.ok
      } catch (e) {
        setLastLog(`${label}: ${e instanceof Error ? e.message : String(e)}`)
        setLastRun({ label, ok: false })
        return false
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

  /** Commitea y devuelve si salió bien; solo entonces se vacía el mensaje. */
  const doCommit = async (): Promise<boolean> => {
    const msg = commitMsg.trim()
    if (!msg) {
      setLastLog(t('git.emptyMessageError'))
      setLastRun({ label: 'git commit', ok: false })
      return false
    }
    const ok = await runAndLog('git commit', () => window.api.gitCommit(targetRef.current, msg))
    if (ok) setCommitMsg('')
    return ok
  }

  const onCommit = (): void => {
    void doCommit()
  }

  const onCommitAndPush = (): void => {
    void (async (): Promise<void> => {
      if (!(await doCommit())) return
      await runAndLog('git push', () => window.api.gitPush(targetRef.current))
    })()
  }

  const onCommitKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return
    e.preventDefault()
    if (canCommit) onCommit()
  }

  const onDiscardConfirmed = (): void => {
    const target = discardTarget
    setDiscardTarget(null)
    if (!target) return
    const label = target.untracked ? `git clean -f ${target.path}` : `git restore ${target.path}`
    void runAndLog(label, () =>
      window.api.gitDiscardFile(targetRef.current, target.path, target.untracked),
    )
  }

  const onSuggestAi = (): void => {
    aiAbortRef.current?.abort()
    const ctrl = new AbortController()
    aiAbortRef.current = ctrl
    setBusy('ai-suggest')
    setLastLog('')
    setLastRun(null)
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
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  /** Lo que realmente viaja en el commit: archivos en el índice y sus líneas. */
  const stagedSummary = useMemo(() => {
    const { staged } = splitGitFilesByArea(status?.files ?? [])
    const totals = gitAreaTotals(staged, parseGitNumStat(status?.stagedDiffNumStat ?? ''))
    return { count: staged.length, ...totals }
  }, [status])
  // Sin upstream `ahead` no viene: entonces se permite push (`push -u` es el caso normal).
  const canPush = repo && idle && (typeof status?.ahead !== 'number' || ahead > 0)
  // La columna derecha ya no se oculta (lleva el diff); lo que se cae es la pestaña.
  const showActionsTab = repo && actionsAvailable
  const effectiveTab: 'diff' | 'actions' = showActionsTab ? sideTab : 'diff'

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
                      {worktrees.length > 1 && (
                        <div className="git-panel-top-bar__worktree">
                          <Select
                            size="sm"
                            aria-label={t('git.worktreeLabel')}
                            value={worktreePath || status.repoRoot || ''}
                            placeholder={t('git.worktreeLabel')}
                            options={gitWorktreeOptions(worktrees)}
                            onChange={setWorktreePath}
                          />
                        </div>
                      )}
                      <div
                        className="git-panel-top-bar__cwd"
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
                        {behind > 0 ? `${t('git.pullButton')} ↓${behind}` : t('git.pullButton')}
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
                      selection={selection}
                      onSelect={setSelection}
                      onDiscardFile={(path, untracked) => setDiscardTarget({ path, untracked })}
                    />
                  )}

                  {lastLog.trim().length > 0 && (
                    <details
                      className={`git-panel-log-strip git-panel-log-strip--${lastRun?.ok ? 'ok' : 'fail'}`}
                    >
                      <summary className="git-panel-log-strip__summary">
                        <span className="git-panel-log-strip__mark" aria-hidden>
                          {lastRun?.ok ? '✓' : '✗'}
                        </span>
                        <code className="git-panel-log-strip__label">
                          {lastRun?.label ?? lastLog.split('\n')[0]}
                        </code>
                      </summary>
                      <pre className="git-panel-log" role="log">{lastLog}</pre>
                    </details>
                  )}

                </>
              )}
            </div>

            {repo && status && (
              <div className="git-panel-commit">
                <TextArea
                  size="md"
                  rows={2}
                  autoGrow
                  placeholder={t('git.commitPlaceholder')}
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  onKeyDown={onCommitKeyDown}
                  spellCheck
                />
                <div className="git-panel-commit-foot">
                  <Tooltip content={t('git.suggestButton')}>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={!idle}
                      aria-label={t('git.suggestButton')}
                      onClick={onSuggestAi}
                    >
                      {busy === 'ai-suggest' ? (
                        <Spinner aria-label={t('git.suggestingAriaLabel')} />
                      ) : (
                        <span className="git-panel-ia-suggest-inner">
                          <Icon name="sparkles" size={14} aria-hidden />
                        </span>
                      )}
                    </Button>
                  </Tooltip>
                  <span className="git-panel-commit-summary">
                    {stagedSummary.count > 0
                      ? t('git.commitSummary', {
                          count: stagedSummary.count,
                          ins: stagedSummary.insertions,
                          del: stagedSummary.deletions,
                        })
                      : t('git.commitHint')}
                  </span>
                  <Button variant="secondary" size="sm" disabled={!canPush} onClick={onPush}>
                    {ahead > 0 ? `${t('git.pushButton')} ↑${ahead}` : t('git.pushButton')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canCommit}
                    onClick={onCommitAndPush}
                  >
                    {t('git.commitAndPushButton')}
                  </Button>
                  <Button variant="primary" size="sm" disabled={!canCommit} onClick={onCommit}>
                    {t('git.commitButton')}
                    <kbd className="git-panel-commit-kbd">{shortcutLabel('↵')}</kbd>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <aside className="git-panel-side">
            <div className="git-panel-side__tabs">
              <SegmentedControl
                size="sm"
                label={t('git.sideTabsLabel')}
                value={effectiveTab}
                onChange={setSideTab}
                options={
                  showActionsTab
                    ? [
                        { value: 'diff', label: t('git.diffTab') },
                        { value: 'actions', label: t('githubActions.title') },
                      ]
                    : [{ value: 'diff', label: t('git.diffTab') }]
                }
              />
              {effectiveTab === 'diff' && selection ? (
                <code className="git-panel-side__path">{selection.path}</code>
              ) : null}
            </div>
            <div className="git-panel-side__pane" hidden={effectiveTab !== 'diff'}>
              <GitDiffPane target={effectiveTarget} selection={selection} refreshToken={statusToken} />
            </div>
            {/* Montado siempre: es quien avisa de si el remoto es de GitHub. */}
            <div className="git-panel-side__pane" hidden={effectiveTab !== 'actions'}>
              <GitHubActionsPanel
                target={effectiveTarget}
                repoStatus={status}
                refreshToken={actionsRefreshToken}
                onAvailable={setActionsAvailable}
              />
            </div>
          </aside>
        </div>
      </TerminalModal>
      <ConfirmTerminalModal
        open={discardTarget !== null}
        zIndex={APP_OVERLAY_MODAL_Z + 10}
        message={t('git.discardConfirmMessage', { path: discardTarget?.path ?? '' })}
        detail={
          discardTarget?.untracked ? t('git.discardConfirmUntracked') : t('git.discardConfirmDetail')
        }
        onConfirm={onDiscardConfirmed}
        onCancel={() => setDiscardTarget(null)}
      />
    </>
  )
}
