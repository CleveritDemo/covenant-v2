import React from 'react'
import './PlaneComposerAurora.css'

/** Borde inferior animado del plano: cinta + bloom cromático del tema. */
export const PlaneComposerAurora: React.FC = () => (
  <div className="plane-composer-aurora" aria-hidden="true">
    <div className="plane-composer-aurora__glow" />
    <div className="plane-composer-aurora__line" />
    <div className="plane-composer-aurora__sheen" />
  </div>
)
