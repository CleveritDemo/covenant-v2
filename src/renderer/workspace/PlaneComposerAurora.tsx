import React from 'react'
import { PlaneComposerAuroraParticles } from './PlaneComposerAuroraParticles'
import './PlaneComposerAurora.css'

type PlaneComposerAuroraProps = {
  active: boolean
}

/** Cinta cromática inferior del plano: estática en idle, en movimiento al trabajar. */
export const PlaneComposerAurora: React.FC<PlaneComposerAuroraProps> = ({ active }) => (
  <div className="plane-composer-aurora" aria-hidden="true">
    <PlaneComposerAuroraParticles active={active} />
    <div className="plane-composer-aurora__line" />
  </div>
)
