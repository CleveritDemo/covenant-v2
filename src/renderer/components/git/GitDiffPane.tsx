import React, { useEffect, useState } from 'react'
import type { GitTarget } from '@shared/gitSessionTypes'
import { parseGitUnifiedDiff, type GitFileDiff } from '@shared/gitDiff'
import { useT } from '@i18n/useT'
import { Spinner } from '../ui/Spinner'
import './GitDiffPane.css'

export interface GitDiffSelection {
  path: string
  area: 'staged' | 'worktree' | 'untracked'
}

interface GitDiffPaneProps {
  target: GitTarget
  selection: GitDiffSelection | null
  /** Cambia cuando el estado del repo se refresca: recarga el diff visible. */
  refreshToken: number
}

export const GitDiffPane: React.FC<GitDiffPaneProps> = ({ target, selection, refreshToken }) => {
  const { t } = useT()
  const [diff, setDiff] = useState<GitFileDiff | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const path = selection?.path ?? ''
  const area = selection?.area ?? 'worktree'
  const targetPath = target.path ?? ''
  const targetSessionId = target.sessionId ?? ''

  useEffect(() => {
    if (!path) {
      setDiff(null)
      setError('')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setDiff(null)
    setError('')
    void (async (): Promise<void> => {
      try {
        const r = await window.api.gitDiffFile(
          { path: targetPath || undefined, sessionId: targetSessionId || undefined },
          path,
          area,
        )
        if (cancelled) return
        if (!r.ok && !r.stdout) {
          setDiff(null)
          setError(r.stderr.trim() || t('git.diffFileError'))
          return
        }
        setDiff(parseGitUnifiedDiff(r.stdout))
        setError('')
      } catch (e) {
        if (cancelled) return
        setDiff(null)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // `t` no va en deps: en react-i18next puede cambiar de identidad y reentrar
    // el efecto en bucle (setDiff → render → nuevo t → cancel → …).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo para mensajes
  }, [path, area, refreshToken, targetPath, targetSessionId])

  if (!path) {
    return <p className="git-diff-pane__hint">{t('git.diffEmptyHint')}</p>
  }

  if (loading || (!diff && !error)) {
    return (
      <div className="git-diff-pane__loading">
        <Spinner aria-label={t('git.diffLoadingAriaLabel')} />
      </div>
    )
  }

  if (error) {
    return (
      <p className="git-diff-pane__hint git-diff-pane__hint--error" role="alert">
        {error}
      </p>
    )
  }

  if (!diff || diff.binary) {
    return <p className="git-diff-pane__hint">{t('git.diffBinary')}</p>
  }

  if (diff.hunks.length === 0) {
    return <p className="git-diff-pane__hint">{t('git.diffNoChanges')}</p>
  }

  return (
    <div className="git-diff-pane__body">
      {diff.hunks.map((hunk, hunkIndex) => (
        <section className="git-diff-pane__hunk" key={`${hunk.header}:${hunkIndex}`}>
          <header className="git-diff-pane__hunk-head">{hunk.header}</header>
          {hunk.lines.map((line, lineIndex) => (
            <div
              className={`git-diff-pane__line git-diff-pane__line--${line.kind}`}
              key={`${hunkIndex}:${lineIndex}`}
            >
              <span className="git-diff-pane__ln" aria-hidden>
                {line.oldLine ?? ''}
              </span>
              <span className="git-diff-pane__ln" aria-hidden>
                {line.newLine ?? ''}
              </span>
              <code className="git-diff-pane__text">{line.text || ' '}</code>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
