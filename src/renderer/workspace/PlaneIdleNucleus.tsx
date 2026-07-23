import React from 'react'
import { IaNucleus } from '../agent/IaNucleus'
import './PlaneIdleNucleus.css'

/** Nucleus en el centro del plano mientras no hay chat abierto. */
export const PlaneIdleNucleus: React.FC = () => (
  <div className="plane-idle-nucleus" aria-hidden="true">
    <IaNucleus size="solo" />
  </div>
)
