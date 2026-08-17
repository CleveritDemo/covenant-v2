import React from 'react'
import './PlaneComposerAurora.css'

export interface PlaneComposerAuroraProps {
  /** Encendido: anima la cinta (mismo look que .plane-chat-composer--working). */
  working?: boolean
}

/** Cinta cromática inferior del composer: estática en idle, en movimiento al trabajar. */
export const PlaneComposerAurora: React.FC<PlaneComposerAuroraProps> = ({
  working = false,
}) => (
  <div
    className={working
      ? 'plane-composer-aurora plane-composer-aurora--working'
      : 'plane-composer-aurora'}
    aria-hidden="true"
  >
    <div className="plane-composer-aurora__line" />
  </div>
)
