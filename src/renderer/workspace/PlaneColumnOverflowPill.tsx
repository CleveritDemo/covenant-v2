import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneColumnOverflowPill.css'

export interface PlaneColumnOverflowPillProps {
  count: number
  direction: 'up' | 'down'
  /** Compacto y circular (columna de agentes). */
  size?: 'default' | 'sm'
  onClick: () => void
}

/** Flecha compacta que indica cards ocultas fuera de la banda visible de la columna. */
export const PlaneColumnOverflowPill: React.FC<PlaneColumnOverflowPillProps> = ({
  count,
  direction,
  size = 'default',
  onClick,
}) => {
  const { t } = useT()

  if (count <= 0) return null

  const label = t('tabs.planeColumnOverflowHidden', { count })

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={[
          'plane-column-overflow-pill',
          size === 'sm' ? 'plane-column-overflow-pill--sm' : '',
          direction === 'up'
            ? 'plane-column-overflow-pill--up'
            : 'plane-column-overflow-pill--down',
        ].join(' ')}
        aria-label={label}
        onClick={onClick}
      >
        <Icon name="chevron-down" size={size === 'sm' ? 11 : 14} aria-hidden />
      </button>
    </Tooltip>
  )
}
