import React from 'react'
import { PlaneComposerAuroraParticles } from './PlaneComposerAuroraParticles'
import { PlaneMapGridParticles } from './PlaneMapGridParticles'
import './PlaneMap.css'

type PlaneMapBackdropProps = {
  /** Floor busy aurora only; grid/music particles always follow `tabActive`. */
  working: boolean
  tabActive?: boolean
}

/** Piso del plano: grilla y partículas detrás de stage, composer y paneles. */
export const PlaneMapBackdrop: React.FC<PlaneMapBackdropProps> = ({
  working,
  tabActive = true,
}) => (
  <div className="plane-map-backdrop" aria-hidden="true">
    <div className="plane-map__atmosphere" />
    <div className="plane-map__grid" />
    <PlaneMapGridParticles active={tabActive} />
    <PlaneComposerAuroraParticles active={working} tabActive={tabActive} />
  </div>
)
