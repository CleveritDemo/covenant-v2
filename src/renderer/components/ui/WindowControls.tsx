import React from 'react'
import './WindowControls.css'

export type WindowControlsSize = 'sm' | 'md'

export interface WindowControlsProps {
  size?: WindowControlsSize
  groupLabel?: string
  closeLabel: string
  minimizeLabel: string
  zoomLabel: string
  onClose: () => void
  onMinimize?: () => void
  onZoom?: () => void
  minimizeDisabled?: boolean
  zoomDisabled?: boolean
}

type TrafficKind = 'close' | 'min' | 'zoom'

function bindTrafficButton(
  kind: TrafficKind,
  label: string,
  handler: (() => void) | undefined,
  forcedDisabled: boolean | undefined,
): React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-hidden'?: boolean } {
  const disabled = forcedDisabled === true || handler == null
  return {
    type: 'button',
    className: `window-controls__btn window-controls__btn--${kind}`,
    'aria-label': label,
    disabled,
    tabIndex: disabled ? -1 : undefined,
    'aria-hidden': disabled ? true : undefined,
    onPointerDown: (event) => {
      event.stopPropagation()
      if (disabled || handler == null) return
      if (event.button !== 0) return
      // preventDefault evita el click duplicado tras pointerdown (ratón);
      // el click de teclado (Enter/Space) sigue disparando onClick.
      event.preventDefault()
      handler()
    },
    onClick: (event) => {
      event.stopPropagation()
      if (disabled || handler == null) return
      handler()
    },
  }
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  size = 'md',
  groupLabel,
  closeLabel,
  minimizeLabel,
  zoomLabel,
  onClose,
  onMinimize,
  onZoom,
  minimizeDisabled,
  zoomDisabled,
}) => (
  <div
    className={[
      'window-controls',
      size === 'sm' ? 'window-controls--sm' : '',
    ].filter(Boolean).join(' ')}
    role="group"
    aria-label={groupLabel}
  >
    <button {...bindTrafficButton('close', closeLabel, onClose, false)} />
    <button {...bindTrafficButton('min', minimizeLabel, onMinimize, minimizeDisabled)} />
    <button {...bindTrafficButton('zoom', zoomLabel, onZoom, zoomDisabled)} />
  </div>
)
