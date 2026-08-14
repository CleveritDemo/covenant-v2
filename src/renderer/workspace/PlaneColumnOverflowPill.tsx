import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import './PlaneColumnOverflowPill.css'

export interface PlaneColumnOverflowPillProps {
  count: number
  direction: 'up' | 'down'
  onClick: () => void
}

/** Pastilla compacta que indica cards ocultas fuera de la banda visible de la columna. */
export const PlaneColumnOverflowPill: React.FC<PlaneColumnOverflowPillProps> = ({
  count,
  direction,
  onClick,
}) => {
  const { t } = useT()

  if (count <= 0) return null

  const label = t('tabs.planeColumnOverflowHidden', { count })

  return (
    <button
      type="button"
      className={[
        'plane-column-overflow-pill',
        direction === 'up'
          ? 'plane-column-overflow-pill--up'
          : 'plane-column-overflow-pill--down',
      ].join(' ')}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name="chevron-down" size={12} />
      <span className="plane-column-overflow-pill__label">{label}</span>
    </button>
  )
}
