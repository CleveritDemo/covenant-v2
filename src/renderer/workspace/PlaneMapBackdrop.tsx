import React from 'react'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
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
    <div className="plane-map__grid" />
    {floorParticles}
    <PlaneMapGridParticles />
  </div>
)
