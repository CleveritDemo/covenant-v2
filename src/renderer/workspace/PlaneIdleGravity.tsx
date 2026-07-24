import React from 'react'
import { Gravity } from '../agent/Gravity'
import './PlaneIdleGravity.css'

/** Gravity en el centro del plano mientras no hay chat abierto. */
export const PlaneIdleGravity: React.FC = () => (
  <div className="plane-idle-gravity" aria-hidden="true">
    <Gravity size="solo" />
  </div>
)
