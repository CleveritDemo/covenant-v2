import React, { useMemo } from 'react'
import type { GitPathEntry } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'
import {
  GIT_STATUS_LETTER,
  gitSplitDisplayPath,
  gitStatusKind,
  gitWorktreePath,
  splitGitFilesByArea,
} from './gitPathUtils'
import { gitEntryAreaStats, parseGitNumStat, type GitFileLineStats } from './gitDiffNumStat'

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

function GitFileLineStatsView({ insertions, deletions }: GitFileLineStats) {
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

interface GitFileGroupProps {
  area: 'index' | 'worktree'
  title: string
  emptyLabel: string
  entries: GitPathEntry[]
  numStat: Map<string, GitFileLineStats>
  idle: boolean
  actionLabel: string
  onAction: () => void
  fileActionLabel: string
  fileActionSign: string
  onFileAction: (relPath: string) => void
}

const GitFileGroup: React.FC<GitFileGroupProps> = ({
  area,
  title,
  emptyLabel,
  entries,
  numStat,
  idle,
  actionLabel,
  onAction,
  fileActionLabel,
  fileActionSign,
  onFileAction,
}) => {
  const { t } = useT()
  const total = useMemo(() => {
    let insertions = 0
    let deletions = 0
    for (const entry of entries) {
      const stats = gitEntryAreaStats(entry, numStat)
      if (!stats) continue
      insertions += stats.insertions
      deletions += stats.deletions
    }
    return { insertions, deletions }
  }, [entries, numStat])

  return (
    <div className="git-file-list__group">
      <header className="git-file-list__group-head">
        <h3 className="git-file-list__title">{title}</h3>
        <span className="git-file-list__count">{entries.length}</span>
        <GitFileLineStatsView insertions={total.insertions} deletions={total.deletions} />
        {entries.length > 0 ? (
          <Button variant="ghost" size="xs" disabled={!idle} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </header>
      <ul className="git-file-list__rows">
        {entries.length === 0 ? (
          <li className="git-file-list__empty">{emptyLabel}</li>
        ) : (
          entries.map(entry => {
            const path = gitWorktreePath(entry)
            const { dir, name } = gitSplitDisplayPath(entry)
            const stats = gitEntryAreaStats(entry, numStat)
            const kind = gitStatusKind(entry, area)

            return (
              <li key={`${entry.status}:${entry.path}`} className="git-file-list__row">
                <span
                  className={`git-file-list__st git-file-list__st--${kind}`}
                  title={`${t(`git.statusNames.${kind}` as 'git.statusNames.modified')} (${entry.status})`}
                  aria-label={t(`git.statusNames.${kind}` as 'git.statusNames.modified')}
                >
                  {GIT_STATUS_LETTER[kind]}
                </span>
                <code className="git-file-list__name" title={path}>
                  {dir ? <span className="git-file-list__dir">{dir}</span> : null}
                  {name}
                </code>
                {stats ? (
                  <GitFileLineStatsView insertions={stats.insertions} deletions={stats.deletions} />
                ) : (
                  <span className="git-file-list__stats git-file-list__stats--empty" aria-hidden />
                )}
                <div className="git-file-list__actions">
                  <Button
                    variant="icon"
                    size="xs"
                    disabled={!idle}
                    aria-label={`${fileActionLabel} ${name}`}
                    onClick={() => onFileAction(path)}
                  >
                    {fileActionSign}
                  </Button>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
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
  const { staged, unstaged } = useMemo(() => splitGitFilesByArea(files), [files])

  if (files.length === 0) {
    return (
      <section className="git-file-list">
        <p className="git-file-list__empty git-file-list__empty--all">{t('git.emptyFiles')}</p>
      </section>
    )
  }

  return (
    <section className="git-file-list" aria-label={t('git.filesTitle')}>
      <div className="git-file-list__scroll">
        <GitFileGroup
          area="index"
          title={t('git.stagedColumnTitle')}
          emptyLabel={t('git.emptyStaged')}
          entries={staged}
          numStat={stagedMap}
          idle={idle}
          actionLabel={t('git.unstageAllButton')}
          onAction={onUnstageAll}
          fileActionLabel={t('git.unstageFileButton')}
          fileActionSign="−"
          onFileAction={onUnstageFile}
        />
        <GitFileGroup
          area="worktree"
          title={t('git.unstagedColumnTitle')}
          emptyLabel={t('git.emptyUnstaged')}
          entries={unstaged}
          numStat={unstagedMap}
          idle={idle}
          actionLabel={t('git.stageAllButton')}
          onAction={onStageAll}
          fileActionLabel={t('git.stageFileButton')}
          fileActionSign="+"
          onFileAction={onStageFile}
        />
      </div>
    </section>
  )
}
