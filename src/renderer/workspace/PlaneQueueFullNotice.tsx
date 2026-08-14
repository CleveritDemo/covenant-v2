import React from 'react'
import { useT } from '@i18n/useT'
import './PlaneQueueFullNotice.css'

/**
 * Aviso inline cuando la cola humana del agente alcanzó el tope y el mensaje
 * volvió al input del composer del plano.
 */
export const PlaneQueueFullNotice: React.FC = () => {
  const { t } = useT()

  return (
    <p className="plane-queue-full-notice" role="status">
      {t('plane.queueFullNotice')}
    </p>
  )
}
