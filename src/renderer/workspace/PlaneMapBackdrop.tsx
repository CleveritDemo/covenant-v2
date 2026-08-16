import React from 'react'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
import { PlaneMapSphericalGrid } from './PlaneMapSphericalGrid'
import './PlaneMap.css'

type PlaneMapBackdropProps = {
  floorParticles?: React.ReactNode
}

/** Piso del plano: grilla, partículas busy y ambiente detrás de stage y composer. */
export const PlaneMapBackdrop: React.FC<PlaneMapBackdropProps> = ({
  floorParticles = null,
}) => (
  <div className="plane-map-backdrop" aria-hidden="true">
    <div className="plane-map__atmosphere" />
    <PlaneMapSphericalGrid />
    {floorParticles}
    <PlaneMapGridParticles />
  </div>
)
