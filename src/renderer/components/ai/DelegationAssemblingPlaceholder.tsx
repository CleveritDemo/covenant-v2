import React from 'react'
import { Gravity } from '../../agent/Gravity'
import './DelegationAssemblingPlaceholder.css'

export interface DelegationAssemblingPlaceholderProps {
  /** Texto ya traducido desde el padre. */
  label: string
}

/**
 * Fase de armado en el stream del orquestador: el fence ia-terminal-delegate
 * está en curso y no debe mostrar JSON. Mismo logo Gravity que AgentDelegatingIndicator.
 */
export const DelegationAssemblingPlaceholder: React.FC<
  DelegationAssemblingPlaceholderProps
> = ({ label }) => (
  <div className="delegation-assembling" role="status" aria-live="polite">
    <div className="delegation-assembling__logo" aria-hidden="true">
      <Gravity size="compact" />
    </div>
    <p className="delegation-assembling__label">{label}</p>
  </div>
)
