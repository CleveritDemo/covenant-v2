import React from 'react'
import { Icon } from '../components/ui'
import './AgentConfigFolderChip.css'

export interface AgentConfigFolderChipProps {
  label: string
  /** Ruta completa; se muestra bajo el nombre, no sólo en el tooltip. */
  path?: string
  title?: string
}

export const AgentConfigFolderChip: React.FC<AgentConfigFolderChipProps> = ({
  label,
  path,
  title,
}) => (
  <div className="agent-config-folder-chip" title={title}>
    <Icon name="folder" size={14} aria-hidden />
    <span className="agent-config-folder-chip__name">{label}</span>
    {path ? (
      // bdi + dirección RTL: al truncar se pierde la raíz, no la carpeta final.
      <bdi className="agent-config-folder-chip__path">{path}</bdi>
    ) : null}
  </div>
)
