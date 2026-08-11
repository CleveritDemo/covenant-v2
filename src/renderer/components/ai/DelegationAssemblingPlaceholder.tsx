import React from 'react'
import './DelegationAssemblingPlaceholder.css'

export interface DelegationAssemblingPlaceholderProps {
  /** Texto ya traducido desde el padre. */
  label: string
}

/**
 * Fase de armado en el stream del orquestador: el fence ia-terminal-delegate
 * está en curso y no debe mostrar JSON. Orbit hermano de AgentDelegatingIndicator.
 */
export const DelegationAssemblingPlaceholder: React.FC<
  DelegationAssemblingPlaceholderProps
> = ({ label }) => (
  <div className="delegation-assembling" role="status" aria-live="polite">
    <div className="delegation-assembling__orbit" aria-hidden="true">
      <span className="delegation-assembling__ring" />
      <span className="delegation-assembling__core" />
      <span className="delegation-assembling__sat delegation-assembling__sat--a" />
      <span className="delegation-assembling__sat delegation-assembling__sat--b" />
      <span className="delegation-assembling__sat delegation-assembling__sat--c" />
    </div>
    <p className="delegation-assembling__label">{label}</p>
  </div>
)
