import React from 'react'
import './AgentConfigSectionRail.css'

export type AgentConfigSection =
  | 'identity'
  | 'objective'
  | 'rules'
  | 'engine'
  | 'permissions'
  | 'contexts'
  | 'orchestration'

export interface AgentConfigSectionItem {
  id: AgentConfigSection
  label: string
  /** Título del grupo; solo se pinta en el primer ítem de cada grupo. */
  group: string
  count?: number
  badge?: string
  /** Badge en tono de aviso (p. ej. permisos Auto). */
  warn?: boolean
  /** Borrador con cambios aún no persistidos. */
  dirty?: boolean
}

export interface AgentConfigSectionRailProps {
  items: AgentConfigSectionItem[]
  value: AgentConfigSection
  label: string
  onChange: (section: AgentConfigSection) => void
}

/** Índice lateral del modal de configuración: navega y resume cada sección. */
export const AgentConfigSectionRail: React.FC<AgentConfigSectionRailProps> = ({
  items,
  value,
  label,
  onChange,
}) => (
  <nav className="agent-config-rail" aria-label={label}>
    {items.map((item, index) => {
      const active = item.id === value
      const startsGroup = index === 0 || items[index - 1]?.group !== item.group
      return (
        <React.Fragment key={item.id}>
          {startsGroup ? (
            <p className="agent-config-rail__group">{item.group}</p>
          ) : null}
          <button
            type="button"
            className={`agent-config-rail__item${active ? ' agent-config-rail__item--on' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="agent-config-rail__label">{item.label}</span>
            {item.dirty ? <span className="agent-config-rail__dirty" aria-hidden /> : null}
            {typeof item.count === 'number' && item.count > 0 ? (
              <span className="agent-config-rail__count">{item.count}</span>
            ) : null}
            {item.badge ? (
              <span
                className={`agent-config-rail__badge${item.warn ? ' agent-config-rail__badge--warn' : ''}`}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        </React.Fragment>
      )
    })}
  </nav>
)
