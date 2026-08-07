import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneSketchButton.css'

export interface PlaneSketchButtonProps {
  label: string
  disabled?: boolean
  onClick: () => void
}

/** Abre el lienzo de sketch desde el composer del plane. */
export const PlaneSketchButton: React.FC<PlaneSketchButtonProps> = ({
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className="plane-sketch-btn"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="pencil" size={14} />
  </button>
)
