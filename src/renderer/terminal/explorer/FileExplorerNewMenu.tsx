import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import { FileExplorerMenuItem } from './FileExplorerMenuItem'

interface FileExplorerNewMenuProps {
  x: number
  y: number
  onNewFile: () => void
  onNewDir: () => void
  onClose: () => void
}

export const FileExplorerNewMenu: React.FC<FileExplorerNewMenuProps> = ({
  x,
  y,
  onNewFile,
  onNewDir,
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

  const menuLeft = Math.min(x, Math.max(8, window.innerWidth - 148))
  const menuTop = Math.min(y, Math.max(8, window.innerHeight - 80))

  return createPortal(
    <div
      ref={menuRef}
      className="file-explorer-context-menu"
      role="menu"
      style={{ '--menu-x': `${menuLeft}px`, '--menu-y': `${menuTop}px` } as React.CSSProperties}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
    >
      <FileExplorerMenuItem label={t('fileExplorer.toolbar.newFile')} onClick={onNewFile} />
      <FileExplorerMenuItem label={t('fileExplorer.toolbar.newFolder')} onClick={onNewDir} />
    </div>,
    document.body,
  )
}
