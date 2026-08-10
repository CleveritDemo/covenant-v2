import React, { useMemo } from 'react'
import './DictationListeningOverlay.css'

const BAR_COUNT = 32

export interface DictationListeningOverlayProps {
  active: boolean
  /** Mic level 0–1; 0 → animación de espera. */
  level: number
  /** Interim o etiqueta «Te escucho…». */
  text: string
}

/**
 * Overlay suave sobre el stream: waveform + transcript en vivo.
 * Sin card pesada; se ancla encima del composer (bottom: 100%).
 */
export const DictationListeningOverlay: React.FC<DictationListeningOverlayProps> = ({
  active,
  level,
  text,
}) => {
  const reactive = level > 0.02
  const bars = useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, index) => {
      const wave = 0.28 + 0.72 * Math.abs(Math.sin(index * 0.42 + level * 4.2))
      const height = Math.max(0.14, Math.min(1, (0.18 + level * 0.92) * wave))
      return height
    }),
    [level],
  )

  if (!active) return null

  return (
    <div
      className={[
        'dictation-listening-overlay',
        reactive ? 'dictation-listening-overlay--live' : 'dictation-listening-overlay--idle',
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="dictation-listening-overlay__wave" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className="dictation-listening-overlay__bar"
            style={{
              ['--dictation-bar-h' as string]: String(height),
              ['--dictation-bar-i' as string]: String(index),
            }}
          />
        ))}
      </div>
      <p className="dictation-listening-overlay__text">{text}</p>
    </div>
  )
}
