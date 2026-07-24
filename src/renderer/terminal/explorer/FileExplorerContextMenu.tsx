import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import { FileExplorerMenuItem } from './FileExplorerMenuItem'

export interface FileExplorerContextMenuTarget {
  relPath: string
  isDirectory: boolean
  name: string
}

interface FileExplorerContextMenuProps {
  x: number
  y: number
  target: FileExplorerContextMenuTarget | null
  selectionCount: number
  showHiddenDirs: boolean
  openOnSingleClick: boolean
  onCopy: () => void
  onCut: () => void
  onCopyName: () => void
  onCopyRelPath: () => void
  onPaste: () => void
  onRename: () => void
  onDelete: () => void
  onRevealInFinder: () => void
  onNewFile: () => void
  onNewDir: () => void
  onRefresh: () => void
  onToggleHiddenDirs: () => void
  onToggleOpenOnSingleClick: () => void
  onClose: () => void
}

export const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  target,
  selectionCount,
  showHiddenDirs,
  openOnSingleClick,
  onCopy,
  onCut,
  onCopyName,
  onCopyRelPath,
  onPaste,
  onRename,
  onDelete,
  onRevealInFinder,
  onNewFile,
  onNewDir,
  onRefresh,
  onToggleHiddenDirs,
  onToggleOpenOnSingleClick,
  onClose,
}) => {
  const { t } = useT()
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      if (menuRef.current?.contains(e.target as Node)) return
      onCloseRef.current()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [])

  const menuLeft = Math.min(x, Math.max(8, window.innerWidth - 168))
  const menuTop = Math.min(y, Math.max(8, window.innerHeight - 320))
  const multi = selectionCount > 1
  const canCreateHere = !target || target.isDirectory

  return createPortal(
    <div
      ref={menuRef}
      className="file-explorer-context-menu"
      role="menu"
      style={{ '--menu-x': `${menuLeft}px`, '--menu-y': `${menuTop}px` } as React.CSSProperties}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
    >
      {canCreateHere && (
        <>
          <FileExplorerMenuItem label={t('fileExplorer.contextMenu.newFileHere')} onClick={onNewFile} />
          <FileExplorerMenuItem label={t('fileExplorer.contextMenu.newDirHere')} onClick={onNewDir} />
          <div className="file-explorer-context-menu__sep" role="separator" />
        </>
      )}
      {target ? (
        <>
          <FileExplorerMenuItem
            label={multi
              ? t('fileExplorer.contextMenu.copyMany', { count: selectionCount })
              : t('fileExplorer.contextMenu.copy')}
            onClick={onCopy}
          />
          <FileExplorerMenuItem
            label={multi
              ? t('fileExplorer.contextMenu.cutMany', { count: selectionCount })
              : t('fileExplorer.contextMenu.cut')}
            onClick={onCut}
          />
          {!multi && (
            <>
              <FileExplorerMenuItem label={t('fileExplorer.contextMenu.copyName')} onClick={onCopyName} />
              <FileExplorerMenuItem label={t('fileExplorer.contextMenu.copyPath')} onClick={onCopyRelPath} />
            </>
          )}
          {!multi && (
            <FileExplorerMenuItem label={t('fileExplorer.contextMenu.rename')} onClick={onRename} />
          )}
          <FileExplorerMenuItem
            danger
            label={multi
              ? t('fileExplorer.contextMenu.deleteMany', { count: selectionCount })
              : t('fileExplorer.contextMenu.delete')}
            onClick={onDelete}
          />
          {!multi && (
            <FileExplorerMenuItem
              label={t('fileExplorer.contextMenu.revealInFinder')}
              onClick={onRevealInFinder}
            />
          )}
          <div className="file-explorer-context-menu__sep" role="separator" />
          <FileExplorerMenuItem label={t('fileExplorer.contextMenu.paste')} onClick={onPaste} />
        </>
      ) : (
        <FileExplorerMenuItem label={t('fileExplorer.contextMenu.paste')} onClick={onPaste} />
      )}
      <div className="file-explorer-context-menu__sep" role="separator" />
      <FileExplorerMenuItem label={t('fileExplorer.contextMenu.refresh')} onClick={onRefresh} />
      <FileExplorerMenuItem
        label={showHiddenDirs
          ? t('fileExplorer.contextMenu.toggleHiddenDirsOff')
          : t('fileExplorer.contextMenu.toggleHiddenDirsOn')}
        onClick={onToggleHiddenDirs}
      />
      <FileExplorerMenuItem
        label={openOnSingleClick
          ? t('fileExplorer.contextMenu.openOnDoubleClick')
          : t('fileExplorer.contextMenu.openOnSingleClick')}
        onClick={onToggleOpenOnSingleClick}
      />
    </div>,
    document.body,
  )
}
