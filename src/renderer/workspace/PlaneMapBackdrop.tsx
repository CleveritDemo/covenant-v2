import React from 'react'
import { planeEnergyTargetForBusyCount } from './planeEnergyEnvelope'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
import { PlaneMapSphericalGrid } from './PlaneMapSphericalGrid'
import './PlaneMap.css'

type PlaneMapBackdropProps = {
  floorParticles?: React.ReactNode
  /** Agentes trabajando ahora: enciende grilla y partículas. */
  busyAgentCount?: number
}

/** Piso del plano: grilla, partículas busy y ambiente detrás de stage y composer. */
export const PlaneMapBackdrop: React.FC<PlaneMapBackdropProps> = ({
  floorParticles = null,
  busyAgentCount = 0,
}) => {
  const energyTarget = planeEnergyTargetForBusyCount(busyAgentCount)
  return (
    <div className="plane-map-backdrop" aria-hidden="true">
      <div className="plane-map__atmosphere" />
      <PlaneMapSphericalGrid energyTarget={energyTarget} />
      {floorParticles}
      <PlaneMapGridParticles energyTarget={energyTarget} />
      {/* Encima del parallax/grilla: aísla el piso; UI (stage/composer) queda arriba. */}
      <div className="plane-map-backdrop__shield" />
    </div>
  )
}
