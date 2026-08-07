import React, { useMemo } from 'react'
import type { GitPathEntry } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'
import {
  canGitStageEntry,
  canGitUnstageEntry,
  gitDisplayFileName,
  gitWorktreePath,
} from './gitPathUtils'
import { gitFileLineStats, parseGitNumStat } from './gitDiffNumStat'

interface GitFileListProps {
  files: GitPathEntry[]
  unstagedNumStat: string
  stagedNumStat: string
  idle: boolean
  onStageFile: (relPath: string) => void
  onUnstageFile: (relPath: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
}

function GitFileLineStatsView({ insertions, deletions }: { insertions: number; deletions: number }) {
  if (insertions === 0 && deletions === 0) return null
  return (
    <span className="git-file-list__stats">
      {insertions > 0 ? (
        <span className="git-file-list__stat git-file-list__stat--plus">
          +{insertions}
        </span>
      ) : null}
      {deletions > 0 ? (
        <span className="git-file-list__stat git-file-list__stat--minus">
          −{deletions}
        </span>
      ) : null}
    </span>
  )
}

export const GitFileList: React.FC<GitFileListProps> = ({
  files,
  unstagedNumStat,
  stagedNumStat,
  idle,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
}) => {
  const { t } = useT()
  const unstagedMap = useMemo(() => parseGitNumStat(unstagedNumStat), [unstagedNumStat])
  const stagedMap = useMemo(() => parseGitNumStat(stagedNumStat), [stagedNumStat])

  const stageableCount = useMemo(() => files.filter(canGitStageEntry).length, [files])
  const unstagedCount = useMemo(() => files.filter(canGitUnstageEntry).length, [files])

  return (
    <section className="git-file-list">
      <header className="git-file-list__head">
        <h3 className="git-file-list__title">{t('git.filesTitle')}</h3>
        <div className="git-file-list__head-actions">
          {stageableCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={!idle}
              onClick={onStageAll}
            >
              {t('git.stageAllButton')}
            </Button>
          ) : null}
          {unstagedCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={!idle}
              onClick={onUnstageAll}
            >
              {t('git.unstageAllButton')}
            </Button>
          ) : null}
          <span className="git-file-list__count">{files.length}</span>
        </div>
      </header>
      <ul className="git-file-list__rows">
        {files.length === 0 ? (
          <li className="git-file-list__empty">{t('git.emptyFiles')}</li>
        ) : (
          files.map(entry => {
            const path = gitWorktreePath(entry)
            const name = gitDisplayFileName(entry)
            const stats = gitFileLineStats(entry, unstagedMap, stagedMap)
            const canStage = canGitStageEntry(entry)
            const canUnstage = canGitUnstageEntry(entry)
            const status = entry.status.trim() || '?'

            return (
              <li key={`${entry.status}:${entry.path}`} className="git-file-list__row">
                <code className="git-file-list__name">
                  {name}
                </code>
                <span className="git-file-list__status" aria-label={entry.status}>
                  {status}
                </span>
                {stats ? (
                  <GitFileLineStatsView insertions={stats.insertions} deletions={stats.deletions} />
                ) : (
                  <span className="git-file-list__stats git-file-list__stats--empty" aria-hidden />
                )}
                <div className="git-file-list__actions">
                  {canStage ? (
                    <Button
                      variant="icon"
                      size="xs"
                      disabled={!idle}
                      aria-label={`${t('git.stageFileButton')} ${name}`}
                      onClick={() => onStageFile(path)}
                    >
                      +
                    </Button>
                  ) : null}
                  {canUnstage ? (
                    <Button
                      variant="icon"
                      size="xs"
                      disabled={!idle}
                      aria-label={`${t('git.unstageFileButton')} ${name}`}
                      onClick={() => onUnstageFile(path)}
                    >
                      −
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
