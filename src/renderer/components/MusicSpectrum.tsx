import React, { useEffect, useRef } from 'react'

const SPECTRUM_BARS = 8

const SPECTRUM_STATIC_LEVELS: number[] = Array.from({ length: SPECTRUM_BARS }, (_, i) => {
  const v = 0.14 + 0.11 * (0.5 + 0.5 * Math.sin(i * 0.85 + 0.3))
  return Math.round(v * 1000) / 1000
})

interface MusicSpectrumProps {
  animating: boolean
}

export const MusicSpectrum: React.FC<MusicSpectrumProps> = ({ animating }) => {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const t0Ref = useRef(0)

  useEffect(() => {
    if (!animating) {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      return
    }
    t0Ref.current = performance.now()
    const tick = (now: number): void => {
      const t = now - t0Ref.current
      const seed = t0Ref.current * 0.00007
      for (let i = 0; i < SPECTRUM_BARS; i++) {
        const el = barRefs.current[i]
        if (!el) continue
        const phase = t * 0.0048 + i * 0.52 + seed
        const slow = 0.5 + 0.5 * Math.sin(phase)
        const fast = 0.5 + 0.5 * Math.sin(phase * 2.31 + i * 0.4)
        const v = 0.14 + 0.42 * slow * fast + 0.18 * Math.sin(phase * 0.37 + 2)
        el.style.setProperty('--bar-lv', String(Math.max(0.1, Math.min(1, v))))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [animating])

  return (
    <div
      className={['titlebar-music-spectrum', !animating ? 'titlebar-music-spectrum--idle' : ''].filter(Boolean).join(' ')}
      aria-hidden
    >
      {SPECTRUM_STATIC_LEVELS.map((lv, i) => (
        <span
          key={i}
          ref={el => { barRefs.current[i] = el }}
          className="titlebar-music-spectrum__bar"
          style={animating ? undefined : { '--bar-lv': lv } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
