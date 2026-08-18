import React, { useCallback, useRef, useState } from 'react'
import { ConfirmTerminalModal } from '@renderer/components/ConfirmTerminalModal'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { useT } from '@i18n/useT'

export type ExplorerConfirmRequest =
  | { type: 'delete'; message: string; onConfirm: () => void }
  | { type: 'discardChanges'; onConfirm: () => void }
  | { type: 'closeDirtyFile'; onConfirm: () => void }

interface ExplorerConfirmHostProps {
  children: (requestConfirm: (req: ExplorerConfirmRequest) => Promise<boolean>) => React.ReactNode
  zIndex?: number
}

export const ExplorerConfirmHost: React.FC<ExplorerConfirmHostProps> = ({ children, zIndex }) => {
  const { t } = useT()
  const [pending, setPending] = useState<ExplorerConfirmRequest | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const requestConfirm = useCallback((req: ExplorerConfirmRequest): Promise<boolean> => {
    return new Promise(resolve => {
      if (resolveRef.current) {
        const prev = resolveRef.current
        resolveRef.current = null
        prev(false)
      }
      resolveRef.current = resolve
      setPending(req)
    })
  }, [])

  const close = useCallback((ok: boolean): void => {
    if (!pending) return
    const resolve = resolveRef.current
    resolveRef.current = null
    setPending(null)
    if (ok) pending.onConfirm()
    resolve?.(ok)
  }, [pending])

  const message = pending?.type === 'delete'
    ? pending.message
    : pending?.type === 'discardChanges'
      ? t('fileExplorer.confirm.discardChanges')
      : pending?.type === 'closeDirtyFile'
        ? t('fileExplorer.confirm.closeDirtyFile')
        : ''

  return (
    <>
      {children(requestConfirm)}
      <ConfirmTerminalModal
        open={pending !== null}
        message={message}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
        // El confirm tiene que superar la z de la ventana del explorador o el usuario no lo ve y la acción parece muerta.
        zIndex={zIndex ?? APP_OVERLAY_MODAL_Z + 10}
      />
    </>
  )
}
