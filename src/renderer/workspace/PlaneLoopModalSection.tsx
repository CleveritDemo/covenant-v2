import React from 'react'
import './PlaneLoopModalSection.css'

export interface PlaneLoopModalSectionProps {
  /** Número de paso visible (1, 2…). */
  step?: number
  title: string
  hint?: string
  children: React.ReactNode
}

/** Bloque de paso del flujo de loops (elige agente, interacción, ritmo). */
export const PlaneLoopModalSection: React.FC<PlaneLoopModalSectionProps> = ({
  step,
  title,
  hint,
  children,
}) => (
  <section className="plane-loop-modal-section" aria-label={title}>
    <header className="plane-loop-modal-section__header">
      {typeof step === 'number' ? (
        <span className="plane-loop-modal-section__step" aria-hidden="true">
          {step}
        </span>
      ) : null}
      <div className="plane-loop-modal-section__titles">
        <h3 className="plane-loop-modal-section__title">{title}</h3>
        {hint ? <p className="plane-loop-modal-section__hint">{hint}</p> : null}
      </div>
    </header>
    <div className="plane-loop-modal-section__body">{children}</div>
  </section>
)
