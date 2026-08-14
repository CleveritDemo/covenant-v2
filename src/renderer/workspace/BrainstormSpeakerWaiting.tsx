import React, { useEffect, useState } from 'react'
import type { BrainstormSpeakerPhase } from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import './BrainstormSpeakerWaiting.css'

const STEPS = [
  { phase: 'starting', label: 'tabs.brainstormWaitPrepared' },
  { phase: 'reading', label: 'tabs.brainstormWaitReading' },
  { phase: 'writing', label: 'tabs.brainstormWaitWriting' },
] as const

const ORDER: Record<BrainstormSpeakerPhase, number> = {
  starting: 0,
  reading: 1,
  writing: 2,
}

/** Un minuto sin abrir la boca ya no es «tarda un poco». */
const SLOW_AFTER_SECONDS = 60

export interface BrainstormSpeakerWaitingProps {
  name: string
  role?: string
  phase: BrainstormSpeakerPhase
  /** Qué está leyendo, con nombre: el working set de la sala. */
  material: string[]
  /** Cambia con cada turno: reinicia el reloj. */
  turnKey: string
}

/**
 * Lo que se ve entre que un agente recibe el turno y escribe su primera
 * palabra. Puede ser medio minuto: Gravity hace `spawn` de un CLI real, que
 * carga su MCP y sus skills, y encima el modelo se lee el contexto entero antes
 * de emitir un token. Antes esto era una línea fija —«X · getting ready…»— que
 * no cambiaba nunca, así que no había forma de distinguir «trabajando» de
 * «colgado».
 *
 * Los pasos avanzan con hechos (`speaker_start`, el primer evento del CLI, el
 * primer delta), nunca con el reloj. Por eso tampoco hay barra de progreso:
 * nadie sabe cuánto va a tardar el modelo, y una barra que se llena sola se
 * nota falsa justo cuando más se está mirando.
 */
export const BrainstormSpeakerWaiting: React.FC<BrainstormSpeakerWaitingProps> = ({
  name,
  role,
  phase,
  material,
  turnKey,
}) => {
  const { t } = useT()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [turnKey])

  const current = ORDER[phase] ?? 0
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="brainstorm-wait" role="status">
      <div className="brainstorm-wait__head">
        <span className="brainstorm-wait__name">{name}</span>
        {role ? <span className="brainstorm-wait__role">{role}</span> : null}
        <span className="brainstorm-wait__clock">{clock}</span>
      </div>

      <ol className="brainstorm-wait__steps">
        {STEPS.map((step, index) => (
          <li
            key={step.phase}
            className={[
              'brainstorm-wait__step',
              index < current ? 'brainstorm-wait__step--done' : '',
              index === current ? 'brainstorm-wait__step--now' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="brainstorm-wait__dot" aria-hidden />
            <span>
              {t(step.label)}
              {/* Qué está leyendo, con nombre: «leyendo» a secas no dice qué. */}
              {step.phase === 'reading' && material.length ? (
                <span className="brainstorm-wait__detail">{material.join(' · ')}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {seconds >= SLOW_AFTER_SECONDS ? (
        <p className="brainstorm-wait__slow">{t('tabs.brainstormWaitSlow')}</p>
      ) : null}
    </div>
  )
}
