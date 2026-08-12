import React from 'react'
import { PlaneComposerAuroraParticles } from './PlaneComposerAuroraParticles'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
import './PlaneMap.css'

type PlaneMapBackdropProps = {
  working: boolean
}

/** Piso del plano: grilla y partículas detrás de stage, composer y paneles. */
export const PlaneMapBackdrop: React.FC<PlaneMapBackdropProps> = ({ working }) => (
  <div className="plane-map-backdrop" aria-hidden="true">
    <div className="plane-map__atmosphere" />
    <div className="plane-map__grid" />
    <PlaneMapGridParticles />
    <PlaneComposerAuroraParticles active={working} />
  </div>
)
