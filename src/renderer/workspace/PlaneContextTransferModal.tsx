import React from 'react'
import type { ContextTransferTarget } from '@shared/contextTransfer'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { TerminalModal } from '../components/TerminalModal'
import { Icon } from '../components/ui/Icon'
import { OptionRow } from '../components/ui/OptionRow'
import './PlaneContextTransferModal.css'

export interface PlaneContextTransferModalProps {
  open: boolean
  title: string
  contextName: string
  targets: ContextTransferTarget[]
  emptyHint: string
  onSelect: (target: ContextTransferTarget) => void
  onClose: () => void
}

/** Modal para elegir el workspace destino al enviar un contexto. */
export const PlaneContextTransferModal: React.FC<PlaneContextTransferModalProps> = ({
  open,
  title,
  contextName,
  targets,
  emptyHint,
  onSelect,
  onClose,
}) => (
  <TerminalModal
    open={open}
    onClose={onClose}
    title={title}
    titleId="plane-context-transfer-title"
    size="md"
    bodyLayout="spacious"
    closeOnBackdrop
    zIndex={APP_OVERLAY_MODAL_Z}
  >
    <div className="plane-context-transfer-modal">
      <p className="plane-context-transfer-modal__context">{contextName}</p>
      {targets.length > 0 ? (
        <div
          className="plane-context-transfer-modal__list"
          role="listbox"
          aria-label={title}
        >
          {targets.map(target => (
            <OptionRow
              key={target.tabId}
              icon={<Icon name="folder" size={14} aria-hidden />}
              title={target.title}
              hint={target.cwd}
              onClick={() => onSelect(target)}
            />
          ))}
        </div>
      ) : (
        <p className="plane-context-transfer-modal__empty">{emptyHint}</p>
      )}
    </div>
  </TerminalModal>
)
