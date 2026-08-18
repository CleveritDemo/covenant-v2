import React, { useEffect, useState } from 'react'
import type { GitTarget } from '@shared/gitSessionTypes'
import { parseGitUnifiedDiff, type GitFileDiff } from '@shared/gitDiff'
import { useT } from '@i18n/useT'
import { Spinner } from '../ui/Spinner'
import { GitDiffEmptyState } from './GitDiffEmptyState'
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

function isUntrackedFolder(selection: GitDiffSelection | null): boolean {
  return Boolean(selection && selection.area === 'untracked' && selection.path.endsWith('/'))
}

export const GitDiffPane: React.FC<GitDiffPaneProps> = ({ target, selection, refreshToken }) => {
  const { t } = useT()
  const [diff, setDiff] = useState<GitFileDiff | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const path = selection?.path ?? ''
  const area = selection?.area ?? 'worktree'
  const targetPath = target.path ?? ''
  const targetSessionId = target.sessionId ?? ''
  const untrackedFolder = isUntrackedFolder(selection)

  useEffect(() => {
    if (!path || untrackedFolder) {
      setDiff(null)
      setError(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setDiff(null)
    setError(false)
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
          setError(true)
          if (r.stderr) console.debug(r.stderr)
          return
        }
        setDiff(parseGitUnifiedDiff(r.stdout))
        setError(false)
      } catch (e) {
        if (cancelled) return
        setDiff(null)
        setError(true)
        console.debug(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, area, untrackedFolder, refreshToken, targetPath, targetSessionId])

  if (!path) {
    return <GitDiffEmptyState icon="file" title={t('git.diffEmptyHint')} />
  }

  if (untrackedFolder) {
    return (
      <GitDiffEmptyState
        icon="folder"
        title={t('git.diffUntrackedFolderTitle')}
        hint={t('git.diffUntrackedFolderHint')}
      />
    )
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
      <GitDiffEmptyState
        icon="file"
        tone="error"
        title={t('git.diffErrorTitle')}
        hint={t('git.diffErrorHint')}
      />
    )
  }

  if (!diff || diff.binary) {
    return <GitDiffEmptyState icon="file" title={t('git.diffBinary')} />
  }

  if (diff.hunks.length === 0) {
    return <GitDiffEmptyState icon="file" title={t('git.diffNoChanges')} />
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
