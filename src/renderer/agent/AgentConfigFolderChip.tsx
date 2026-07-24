import React from 'react'
import { Icon } from '../components/ui'
import './AgentConfigFolderChip.css'

export interface AgentConfigFolderChipProps {
  label: string
  hint: string
  title?: string
}

export const AgentConfigFolderChip: React.FC<AgentConfigFolderChipProps> = ({
  label,
  hint,
  title,
}) => (
  <div className="agent-config-folder-chip" title={title}>
    <Icon name="folder" size={13} aria-hidden />
    <span className="agent-config-folder-chip__label">{label}</span>
    <span className="agent-config-folder-chip__hint">{hint}</span>
  </div>
)
