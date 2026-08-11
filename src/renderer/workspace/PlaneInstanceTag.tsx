import React from 'react'
import './PlaneInstanceTag.css'

export interface PlaneInstanceTagProps {
  /** `R2` en la réplica; `+2` en el experto base. */
  text: string
  /** instance = réplica temporal (ámbar); count = réplicas vivas del base. */
  variant?: 'instance' | 'count'
}

/**
 * Tag de instancia junto al nombre del agente. Una réplica se sigue llamando
 * como su experto: lo que la distingue es este número, el mismo que lleva su id.
 */
export const PlaneInstanceTag: React.FC<PlaneInstanceTagProps> = ({
  text,
  variant = 'instance',
}) => (
  <span
    className={[
      'plane-instance-tag',
      variant === 'count' ? 'plane-instance-tag--count' : '',
    ].filter(Boolean).join(' ')}
  >
    {text}
  </span>
)
