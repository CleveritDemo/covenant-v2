import React from 'react'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
import './PlaneMap.css'

/** Piso del plano: grilla detrás de stage, composer y paneles. */
export const PlaneMapBackdrop: React.FC = () => (
  <div className="plane-map-backdrop" aria-hidden="true">
    <div className="plane-map__atmosphere" />
    <div className="plane-map__grid" />
    <PlaneMapGridParticles />
  </div>
)
