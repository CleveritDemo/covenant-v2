import React, { useRef } from 'react'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { useT } from '@i18n/useT'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { FileExplorerEntryIcon } from './FileExplorerEntryIcon'
import type { ExplorerGitStatus } from './fileExplorerGitStatus'

interface FileExplorerTreeNodeProps {
  entry: FileExplorerEntry
  depth: number
  expanded: boolean
  loading: boolean
  selected: boolean
  multiSelected: boolean
  cutMarked?: boolean
  dragOver?: boolean
  gitStatus?: ExplorerGitStatus | null
  isRenaming: boolean
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onToggleDir: (relPath: string) => void
  onSelectEntry: (relPath: string, isDirectory: boolean, e: React.MouseEvent) => void | Promise<void>
  onDoubleClickEntry: (relPath: string, isDirectory: boolean) => void
  onDragStartEntry?: (relPath: string, e: React.DragEvent) => void
  onDragOverDir?: (relPath: string) => void
  onDragLeaveDir?: (relPath: string) => void
  onDropOnDir?: (destRelPath: string, e: React.DragEvent) => void
  nodeId?: string
  tabIndex?: number
  onFocusNode?: () => void
}

export const FileExplorerTreeNode: React.FC<FileExplorerTreeNodeProps> = ({
  entry,
  depth,
  expanded,
  loading,
  selected,
  multiSelected,
  cutMarked = false,
  dragOver = false,
  gitStatus = null,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onToggleDir,
  onSelectEntry,
  onDoubleClickEntry,
  onDragStartEntry,
  onDragOverDir,
  onDragLeaveDir,
  onDropOnDir,
  nodeId,
  tabIndex = -1,
  onFocusNode,
}) => {
  const { t } = useT()
  const isDir = entry.isDirectory
  const escapePressedRef = useRef(false)
  const depthStyle = { '--node-depth': depth } as React.CSSProperties

  const gitClass =
    gitStatus === 'new' ? 'file-explorer-tree-node__name--git-new'
      : gitStatus === 'modified' ? 'file-explorer-tree-node__name--git-modified'
        : gitStatus === 'deleted' ? 'file-explorer-tree-node__name--git-deleted'
          : gitStatus === 'staged' ? 'file-explorer-tree-node__name--git-staged'
            : gitStatus === 'conflict' ? 'file-explorer-tree-node__name--git-conflict'
              : ''

  if (isRenaming) {
    return (
      <form
        className="file-explorer-tree-node file-explorer-tree-node--renaming"
        style={depthStyle}
        onSubmit={e => {
          e.preventDefault()
          onRenameSubmit()
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <span className="file-explorer-tree-node__chevron" aria-hidden>
          {isDir ? (
            loading ? (
              <Spinner aria-label={t('fileExplorer.editor.loading')} />
            ) : (
              <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={10} />
            )
          ) : (
            <span className="file-explorer-tree-node__chevron-spacer" />
          )}
        </span>
        <input
          type="text"
          className="file-explorer-tree-node__rename-input"
          value={renameValue}
          autoFocus
          onChange={e => onRenameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault()
              escapePressedRef.current = true
              onRenameCancel()
            }
          }}
          onBlur={() => {
            if (escapePressedRef.current) {
              escapePressedRef.current = false
              return
            }
            const trimmed = renameValue.trim()
            if (!trimmed || trimmed === entry.name) {
              onRenameCancel()
              return
            }
            onRenameSubmit()
          }}
        />
      </form>
    )
  }

  return (
    <div
      id={nodeId}
      role="treeitem"
      aria-selected={selected || multiSelected}
      aria-expanded={isDir ? expanded : undefined}
      aria-level={depth + 1}
      tabIndex={tabIndex}
      className={[
        'file-explorer-tree-node',
        selected ? 'file-explorer-tree-node--selected' : '',
        multiSelected ? 'file-explorer-tree-node--multi-selected' : '',
        cutMarked ? 'file-explorer-tree-node--cut' : '',
        dragOver ? 'file-explorer-tree-node--drag-over' : '',
        isDir ? 'file-explorer-tree-node--dir' : 'file-explorer-tree-node--file',
      ].filter(Boolean).join(' ')}
      style={depthStyle}
      data-rel-path={entry.relPath}
      data-is-directory={isDir ? 'true' : 'false'}
      data-name={entry.name}
      draggable
      onDragStart={e => {
        onDragStartEntry?.(entry.relPath, e)
        if (!e.dataTransfer.getData('text/plain')) {
          e.dataTransfer.setData('text/plain', entry.relPath)
          e.dataTransfer.effectAllowed = 'move'
        }
      }}
      onDragOver={e => {
        if (!isDir || !onDropOnDir) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        onDragOverDir?.(entry.relPath)
      }}
      onDragLeave={() => {
        if (isDir) onDragLeaveDir?.(entry.relPath)
      }}
      onDrop={e => {
        if (!isDir || !onDropOnDir) return
        e.preventDefault()
        e.stopPropagation()
        onDropOnDir(entry.relPath, e)
      }}
      onClick={e => { void onSelectEntry(entry.relPath, isDir, e) }}
      onDoubleClick={() => onDoubleClickEntry(entry.relPath, isDir)}
      onFocus={onFocusNode}
    >
      {isDir ? (
        <button
          type="button"
          className="file-explorer-tree-node__chevron-btn"
          tabIndex={-1}
          aria-label={expanded ? t('fileExplorer.chevron.collapse') : t('fileExplorer.chevron.expand')}
          onClick={e => {
            e.stopPropagation()
            onToggleDir(entry.relPath)
          }}
          onDoubleClick={e => {
            // Evita que el dblclick del chevron burbujee al row y haga un toggle extra.
            e.stopPropagation()
          }}
        >
          {loading ? (
            <Spinner aria-label={t('fileExplorer.editor.loading')} />
          ) : (
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={10} />
          )}
        </button>
      ) : (
        <span className="file-explorer-tree-node__chevron" aria-hidden>
          <span className="file-explorer-tree-node__chevron-spacer" />
        </span>
      )}
      <span className="file-explorer-tree-node__icon" aria-hidden>
        <FileExplorerEntryIcon name={entry.name} isDirectory={isDir} expanded={expanded} />
      </span>
      <span className={['file-explorer-tree-node__name', gitClass].filter(Boolean).join(' ')}>
        {entry.name}
      </span>
    </div>
  )
}
