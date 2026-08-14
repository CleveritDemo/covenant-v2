import React from 'react'
import {
  BRAINSTORM_ROUND_STOPS,
  brainstormRoundStopIndex,
  brainstormRunMinutes,
  sanitizeBrainstormMaxRounds,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import './BrainstormRoundsSlider.css'

const STOP_KEYS = [
  { name: 'tabs.brainstormRoundsQuick', hint: 'tabs.brainstormRoundsQuickHint' },
  { name: 'tabs.brainstormRoundsBalanced', hint: 'tabs.brainstormRoundsBalancedHint' },
  { name: 'tabs.brainstormRoundsDeep', hint: 'tabs.brainstormRoundsDeepHint' },
] as const

export interface BrainstormRoundsSliderProps {
  value: number
  onChange: (rounds: number) => void
  /** Cuántos hablan: los minutos son turnos × minutos por turno. */
  participantCount: number
}

/**
 * Duración de la sala en tres paradas con nombre. El desplegable obligaba a
 * abrirlo para ver las opciones y truncaba justo la explicación; aquí las tres
 * se comparan de un vistazo y el número lleva unidad de tiempo, que es lo que
 * de verdad se pregunta quien convoca la sala.
 */
export const BrainstormRoundsSlider: React.FC<BrainstormRoundsSliderProps> = ({
  value,
  onChange,
  participantCount,
}) => {
  const { t } = useT()
  const lineId = React.useId()
  const rounds = sanitizeBrainstormMaxRounds(value)
  const index = brainstormRoundStopIndex(rounds)
  const last = BRAINSTORM_ROUND_STOPS.length - 1
  const minutes = brainstormRunMinutes(Math.max(1, participantCount) * rounds)
  const meta = rounds === 1
    ? t('tabs.brainstormRoundsMetaOne', { min: String(minutes) })
    : t('tabs.brainstormRoundsMeta', { rounds: String(rounds), min: String(minutes) })

  return (
    <div className="brainstorm-rounds">
      <p className="brainstorm-rounds__readout">
        <span className="brainstorm-rounds__name">{t(STOP_KEYS[index].name)}</span>
        <span className="brainstorm-rounds__meta">{meta}</span>
      </p>
      <p className="brainstorm-rounds__line" id={lineId}>
        {t(STOP_KEYS[index].hint)}
      </p>
      {/* La var lleva el relleno de la pista: geometría en runtime, no estilo. */}
      <input
        type="range"
        className="brainstorm-rounds__range"
        style={{ '--brainstorm-rounds-pct': `${(index / last) * 100}%` } as React.CSSProperties}
        min={0}
        max={last}
        step={1}
        value={index}
        aria-label={t('tabs.brainstormRoundsLabel')}
        aria-describedby={lineId}
        aria-valuetext={`${t(STOP_KEYS[index].name)} — ${meta}`}
        onChange={event => onChange(BRAINSTORM_ROUND_STOPS[Number(event.target.value)])}
      />
      <div className="brainstorm-rounds__ticks">
        {BRAINSTORM_ROUND_STOPS.map((stop, i) => (
          <button
            key={stop}
            type="button"
            className="brainstorm-rounds__tick"
            aria-current={i === index}
            onClick={() => onChange(stop)}
          >
            {t(STOP_KEYS[i].name)}
          </button>
        ))}
      </div>
    </div>
  )
}
