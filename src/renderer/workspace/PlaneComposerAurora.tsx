import React from 'react'
import './PlaneComposerAurora.css'

/** Cinta cromática inferior del plano: estática en idle, en movimiento al trabajar. */
export const PlaneComposerAurora: React.FC = () => (
  <div className="plane-composer-aurora" aria-hidden="true">
    <div className="plane-composer-aurora__line" />
  </div>
)
