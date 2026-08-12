import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import './TitlebarClock.css'

function formatLocalTime24(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Reloj local HH:mm en la titlebar; solo informa, no captura pointer. */
export const TitlebarClock: React.FC = () => {
  const { t } = useT()
  const [time, setTime] = useState(() => formatLocalTime24(new Date()))

  useEffect(() => {
    const tick = (): void => {
      setTime(formatLocalTime24(new Date()))
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <time
      className="titlebar-clock"
      dateTime={time}
      aria-label={t('titlebar.clockAriaLabel', { time })}
    >
      {time}
    </time>
  )
}
