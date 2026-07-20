import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneMiniActions.css'

export interface PlaneMiniActionsProps {
  showConfig?: boolean
  configLabel: string
  deleteLabel: string
  onConfigure?: () => void
  onDelete: () => void
}

export const PlaneMiniActions: React.FC<PlaneMiniActionsProps> = ({
  showConfig = false,
  configLabel,
  deleteLabel,
  onConfigure,
  onDelete,
}) => (
  <div className="plane-mini-actions">
    {showConfig && onConfigure && (
      <button
        type="button"
        className="plane-mini-actions__btn"
        title={configLabel}
        aria-label={configLabel}
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          onConfigure()
        }}
        onPointerDown={event => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerUp={event => event.stopPropagation()}
      >
        <Icon name="settings" size={12} />
      </button>
    )}
    <button
      type="button"
      className="plane-mini-actions__btn plane-mini-actions__btn--danger"
      title={deleteLabel}
      aria-label={deleteLabel}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        onDelete()
      }}
      onPointerDown={event => event.stopPropagation()}
    >
      <Icon name="trash" size={12} />
    </button>
  </div>
)
