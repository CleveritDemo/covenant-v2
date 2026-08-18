import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import {
  FileExplorerSidebar,
  type FileExplorerSidebarHandle,
} from '../terminal/explorer/FileExplorerSidebar'
import '../terminal/explorer/FileExplorer.css'
import { TerminalModal } from '../components/TerminalModal'
import './TabFileExplorerWindow.css'

export interface TabFileExplorerWindowHandle {
  expandParents: (relPath: string) => void
  resetTreeForNewCwd: () => void
}

export interface TabFileExplorerWindowProps {
  sessionId: string
  themeId: string
  cwd: string
  explorerState: FileExplorerPersistedState
  onExplorerStateChange: (patch: Partial<FileExplorerPersistedState>) => void
  onClose: () => void
  title: string
  zIndex?: number
  /** Tab activa: oculta el portal sin cerrar explorerState.open. */
  tabActive?: boolean
}

/** Explorador de archivos como TerminalModal xxl (chrome macOS del modal). */
export const TabFileExplorerWindow = forwardRef<
  TabFileExplorerWindowHandle,
  TabFileExplorerWindowProps
>(function TabFileExplorerWindow(
  {
    sessionId,
    themeId,
    cwd,
    explorerState,
    onExplorerStateChange,
    onClose,
    title,
    zIndex,
    tabActive = true,
  },
  ref,
) {
  const explorerRef = useRef<FileExplorerSidebarHandle>(null)
  const prevSessionIdRef = useRef(sessionId)
  const prevCwdRef = useRef(cwd)

  useImperativeHandle(ref, () => ({
    expandParents: (relPath: string) => {
      explorerRef.current?.expandParents(relPath)
    },
    resetTreeForNewCwd: () => {
      void explorerRef.current?.resetTreeForNewCwd()
    },
  }), [])

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId
    const cwdChanged = prevCwdRef.current !== cwd
    prevSessionIdRef.current = sessionId
    prevCwdRef.current = cwd
    if (!sessionChanged && !cwdChanged) return
    void explorerRef.current?.resetTreeForNewCwd()
  }, [cwd, sessionId])

  return (
    <TerminalModal
      open={explorerState.open}
      active={tabActive}
      onClose={onClose}
      title={title}
      titleId="tab-file-explorer-title"
      size="xxl"
      bodyLayout="flush"
      zIndex={zIndex}
      closeOnBackdrop
    >
      <div className="tab-file-explorer-modal-body">
        <FileExplorerSidebar
          ref={explorerRef}
          sessionId={sessionId}
          themeId={themeId}
          explorerState={explorerState}
          onExplorerStateChange={onExplorerStateChange}
          onToggleExplorer={onClose}
          confirmZIndex={(zIndex ?? APP_OVERLAY_MODAL_Z) + 10}
        />
      </div>
    </TerminalModal>
  )
})
