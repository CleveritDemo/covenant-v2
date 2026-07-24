import React from 'react'
import './AgentPane.css'

export interface AgentPaneAttachmentRemoveProps {
  label: string
  disabled?: boolean
  onClick: () => void
}

/** Quitar adjunto del composer del AgentPane. */
export const AgentPaneAttachmentRemove: React.FC<AgentPaneAttachmentRemoveProps> = ({
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className="agent-pane__attachment-remove"
    disabled={disabled}
    title={label}
    aria-label={label}
    onClick={onClick}
  >
    ×
  </button>
)
