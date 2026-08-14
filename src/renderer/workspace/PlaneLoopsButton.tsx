import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneLoopsButtonProps {
  label: string
  pressed: boolean
  /**
   * Cadenas running/waiting. Va en el aria-label porque el número es la
   * información: «pressed» solo dice si el panel está abierto.
   */
  liveCount?: number
  /** Pulso del badge cuando al menos una cadena está en `running`. */
  livePulse?: boolean
  onClick: () => void
}

export const PlaneLoopsButton: React.FC<PlaneLoopsButtonProps> = ({
  label,
  pressed,
  liveCount = 0,
  livePulse = false,
  onClick,
}) => {
  const { t } = useT()
  const title = liveCount > 0 ? `${label} · ${liveCount}` : label
  return (
    <span className="plane-loops-button-anchor">
      <Tooltip content={title}>
        <button
          type="button"
          className={[
            'plane-loops-button',
            'plane-loops-button--icon-only',
            pressed ? 'plane-loops-button--pressed' : '',
          ].filter(Boolean).join(' ')}
          aria-label={title}
          aria-pressed={pressed}
          onClick={onClick}
        >
          <Icon name="repeat" size={12} />
        </button>
      </Tooltip>
      {liveCount > 0 ? (
        <span
          className={[
            'plane-loops-button-anchor__badge',
            livePulse ? 'plane-loops-button-anchor__badge--pulse' : '',
          ].filter(Boolean).join(' ')}
          aria-label={t('tabs.loopsLiveCountAria', { count: liveCount })}
        >
          {liveCount}
        </span>
      ) : null}
    </span>
  )
}
