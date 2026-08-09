import React, { useMemo, useState } from 'react'
import type { GitPathEntry } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Tooltip } from '../ui/Tooltip'
import type { GitDiffSelection } from './GitDiffPane'
import {
  GIT_STATUS_LETTER,
  filterGitEntries,
  gitSplitDisplayPath,
  gitStatusKind,
  gitWorktreePath,
  splitGitFilesByArea,
} from './gitPathUtils'
import { gitAreaTotals, gitEntryAreaStats, parseGitNumStat, type GitFileLineStats } from './gitDiffNumStat'

/** A partir de aquí la lista deja de escanearse a ojo y aparece el filtro. */
const FILTER_THRESHOLD = 10

interface GitFileListProps {
  files: GitPathEntry[]
  unstagedNumStat: string
  stagedNumStat: string
  idle: boolean
  onStageFile: (relPath: string) => void
  onUnstageFile: (relPath: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
  selection: GitDiffSelection | null
  onSelect: (selection: GitDiffSelection) => void
  onDiscardFile: (relPath: string, untracked: boolean) => void
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
  selection: GitDiffSelection | null
  onSelect: (selection: GitDiffSelection) => void
  /** Solo en el worktree: descartar es destructivo y no aplica al índice. */
  onDiscardFile?: (relPath: string, untracked: boolean) => void
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
  selection,
  onSelect,
  onDiscardFile,
}) => {
  const { t } = useT()
  const total = useMemo(() => gitAreaTotals(entries, numStat), [entries, numStat])

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
            const kindName = t(`git.statusNames.${kind}` as 'git.statusNames.modified')
            const untracked = kind === 'untracked'
            const diffArea: GitDiffSelection['area'] =
              area === 'index' ? 'staged' : untracked ? 'untracked' : 'worktree'
            const selected = selection?.path === path && selection.area === diffArea

            const selectFile = (): void => onSelect({ path, area: diffArea })

            return (
              <li
                key={`${entry.status}:${entry.path}`}
                className={`git-file-list__row${selected ? ' git-file-list__row--selected' : ''}`}
              >
                <Tooltip content={`${kindName} (${entry.status})`}>
                  <span
                    className={`git-file-list__st git-file-list__st--${kind}`}
                    aria-label={kindName}
                  >
                    {GIT_STATUS_LETTER[kind]}
                  </span>
                </Tooltip>
                <Tooltip content={path} hint={t('git.diffRowHint')}>
                  <button
                    type="button"
                    className="git-file-list__name"
                    aria-pressed={selected}
                    onClick={selectFile}
                  >
                    {dir ? <span className="git-file-list__dir">{dir}</span> : null}
                    {name}
                  </button>
                </Tooltip>
                {stats ? (
                  <button
                    type="button"
                    className="git-file-list__stats-hit"
                    aria-label={t('git.diffRowHint')}
                    onClick={selectFile}
                  >
                    <GitFileLineStatsView insertions={stats.insertions} deletions={stats.deletions} />
                  </button>
                ) : (
                  <span className="git-file-list__stats git-file-list__stats--empty" aria-hidden />
                )}
                <div className="git-file-list__actions">
                  {onDiscardFile ? (
                    <Tooltip content={t('git.discardFileButton')}>
                      <Button
                        variant="icon"
                        size="xs"
                        disabled={!idle}
                        aria-label={`${t('git.discardFileButton')} ${name}`}
                        onClick={() => onDiscardFile(path, untracked)}
                      >
                        ⌫
                      </Button>
                    </Tooltip>
                  ) : null}
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
  selection,
  onSelect,
  onDiscardFile,
}) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const unstagedMap = useMemo(() => parseGitNumStat(unstagedNumStat), [unstagedNumStat])
  const stagedMap = useMemo(() => parseGitNumStat(stagedNumStat), [stagedNumStat])
  const visible = useMemo(() => filterGitEntries(files, query), [files, query])
  const { staged, unstaged } = useMemo(() => splitGitFilesByArea(visible), [visible])

  // ↑↓ mueven el foco entre los botones de las filas; espacio/enter los activa (nativo).
  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const buttons = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.git-file-list__name'),
    ].filter(b => !b.disabled)
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? current + 1 : current - 1
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, current < 0 ? 0 : next))]
    if (!target) return
    e.preventDefault()
    target.focus()
  }

  if (files.length === 0) {
    return (
      <section className="git-file-list">
        <p className="git-file-list__empty git-file-list__empty--all">{t('git.emptyFiles')}</p>
      </section>
    )
  }

  return (
    <section className="git-file-list" aria-label={t('git.filesTitle')}>
      {files.length > FILTER_THRESHOLD && (
        <div className="git-file-list__filter">
          <Input
            size="sm"
            variant="inline"
            type="search"
            placeholder={t('git.filterPlaceholder')}
            aria-label={t('git.filterPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="git-file-list__filter-count">
            {visible.length === files.length ? files.length : `${visible.length}/${files.length}`}
          </span>
        </div>
      )}
      <div className="git-file-list__scroll" onKeyDown={onListKeyDown}>
        {visible.length === 0 ? (
          <p className="git-file-list__empty">{t('git.filterNoMatch')}</p>
        ) : (
          <>
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
          selection={selection}
          onSelect={onSelect}
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
          selection={selection}
          onSelect={onSelect}
          onDiscardFile={onDiscardFile}
        />
          </>
        )}
      </div>
    </section>
  )
}
