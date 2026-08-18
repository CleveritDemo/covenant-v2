import React, { useEffect, useState } from 'react'
import type { BrainstormSpeakerPhase } from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { Spinner } from '../components/ui/Spinner'
import './BrainstormSpeakerWaiting.css'

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
 * Hueco entre que un agente recibe el turno y escribe su primera palabra.
 * Puede ser medio minuto: Gravity hace `spawn` de un CLI real. Una sola fila
 * (spinner, nombre, reloj) — sin pasos ni caja; el acta no compite con un panel.
 */
export const BrainstormSpeakerWaiting: React.FC<BrainstormSpeakerWaitingProps> = ({
  name,
  role,
  turnKey,
}) => {
  const { t } = useT()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [turnKey])

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="brainstorm-wait" role="status">
      <div className="brainstorm-wait__head">
        <span className="brainstorm-wait__spinner">
          <Spinner aria-label={t('tabs.brainstormPreparingNow', { name })} />
        </span>
        <span className="brainstorm-wait__name">{name}</span>
        {role ? <span className="brainstorm-wait__role">{role}</span> : null}
        <span className="brainstorm-wait__clock">{clock}</span>
      </div>

      {seconds >= SLOW_AFTER_SECONDS ? (
        <p className="brainstorm-wait__slow">{t('tabs.brainstormWaitSlow')}</p>
      ) : null}
    </div>
  )
}
