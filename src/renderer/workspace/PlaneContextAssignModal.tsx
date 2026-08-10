import React, { useEffect, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { agentMonogram } from '@shared/tabContextAppearance'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { TerminalModal } from '../components/TerminalModal'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { Button } from '../components/ui/Button'
import { Tooltip } from '../components/ui/Tooltip'
import { Icon } from '../components/ui/Icon'
import { ContextPreviewBody } from './ContextContentPreviewModal'
import type { PlaneContextPoolAgent, PlaneContextPoolItem } from './PlaneContextPool'
import './PlaneContextAssignModal.css'

export interface PlaneContextAssignModalProps {
  open: boolean
  context: PlaneContextPoolItem | null
  /** TabContext completo para preview (misma id). */
  previewContext: TabContext | null
  cwd: string
  agents: PlaneContextPoolAgent[]
  assignLabel: string
  assignEmptyHint: string
  editLabel: string
  deleteLabel: string
  deleteConfirmMessage: string
  deleteConfirmDetail: string
  onClose: () => void
  onToggleAssign: (paneId: string, contextId: string) => void
  onEdit?: (contextId: string) => void
  onDelete?: (contextId: string) => void
}

/** Modal de asignación + preview al clic en un chip del pool (sustituye el popover). */
export const PlaneContextAssignModal: React.FC<PlaneContextAssignModalProps> = ({
  open,
  context,
  previewContext,
  cwd,
  agents,
  assignLabel,
  assignEmptyHint,
  editLabel,
  deleteLabel,
  deleteConfirmMessage,
  deleteConfirmDetail,
  onClose,
  onToggleAssign,
  onEdit,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) setConfirmDelete(false)
  }, [open, context?.id])

  if (!context) return null

  const assigned = agents.filter(agent => agent.contextIds.includes(context.id)).length

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        titleId="plane-context-assign-title"
        size="xl"
        bodyLayout="flush"
        closeOnBackdrop
        zIndex={APP_OVERLAY_MODAL_Z}
        headerContent={(
          <div className="plane-context-assign-modal__head">
            <div className="plane-context-assign-modal__title-row">
              <span
                className="plane-context-assign-modal__icon"
                style={{ color: context.color }}
                aria-hidden
              >
                <Icon name={context.icon} size={16} />
              </span>
              <div className="plane-context-assign-modal__title-text">
                <h2 className="plane-context-assign-modal__name">
                  {context.name}
                </h2>
                <p className="plane-context-assign-modal__meta">
                  {context.kindLabel}
                  {agents.length > 0 ? ` · ${assigned}/${agents.length}` : ''}
                </p>
              </div>
              <div className="plane-context-assign-modal__actions">
                {onDelete ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Icon name="trash" size={12} aria-hidden />
                    {deleteLabel}
                  </Button>
                ) : null}
                {onEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const id = context.id
                      onClose()
                      onEdit(id)
                    }}
                  >
                    <Icon name="pencil" size={12} aria-hidden />
                    {editLabel}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="plane-context-assign-modal__agents-block">
              <span className="plane-context-assign-modal__agents-label">{assignLabel}</span>
              {agents.length > 0 ? (
                <div
                  className="plane-context-assign-modal__agents"
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label={assignLabel}
                >
                  {agents.map(agent => {
                    const checked = agent.contextIds.includes(context.id)
                    return (
                      // El nombre ya se ve completo abajo; el tooltip cubre el
                      // truncado en nombres largos, con el tema de la app.
                      <Tooltip key={agent.paneId} content={agent.title}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        className={[
                          'plane-context-assign-modal__agent',
                          checked ? 'plane-context-assign-modal__agent--on' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onToggleAssign(agent.paneId, context.id)}
                      >
                        <span className="plane-context-assign-modal__agent-mono" aria-hidden="true">
                          {agentMonogram(agent.title)}
                        </span>
                        <span className="plane-context-assign-modal__agent-name">{agent.title}</span>
                      </button>
                      </Tooltip>
                    )
                  })}
                </div>
              ) : (
                <p className="plane-context-assign-modal__empty">{assignEmptyHint}</p>
              )}
            </div>
          </div>
        )}
      >
        <div className="plane-context-assign-modal__preview">
          {previewContext ? (
            <ContextPreviewBody context={previewContext} cwd={cwd} />
          ) : null}
        </div>
      </TerminalModal>
      <ConfirmTerminalModal
        open={confirmDelete}
        zIndex={APP_OVERLAY_MODAL_Z + 20}
        message={deleteConfirmMessage}
        detail={deleteConfirmDetail}
        onConfirm={() => {
          const id = context.id
          setConfirmDelete(false)
          onClose()
          onDelete?.(id)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
