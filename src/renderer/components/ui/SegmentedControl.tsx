import React from 'react'
import { Icon, type IconName } from './Icon'
import './SegmentedControl.css'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  title?: string
  disabled?: boolean
  /** Punto sutil (p. ej. hay ajustes fuera de la vista). */
  indicator?: boolean
  /** Glifo a la izquierda de la etiqueta. */
  icon?: IconName
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  options: ReadonlyArray<SegmentedControlOption<T>>
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  /** `equal` reparte el ancho; `scroll` evita truncar labels en filas densas; `hug` ciñe la pista a su contenido (no estira). */
  layout?: 'equal' | 'scroll' | 'hug'
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  size = 'md',
  layout = 'equal',
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      className={[
        'segmented-control',
        `segmented-control--${size}`,
        `segmented-control--${layout}`,
      ].join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(option => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.title}
            disabled={disabled || option.disabled}
            className={[
              'segmented-control__btn',
              selected ? 'segmented-control__btn--active' : '',
              option.indicator ? 'segmented-control__btn--indicator' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onChange(option.value)}
          >
            {/*
              El pill vive en este span, no en el botón: el botón ocupa toda la
              columna (área de clic completa) mientras el fondo activo se ciñe a
              la etiqueta. Pintándolo en el botón, una palabra corta como
              «Ideas» quedaba flotando dentro de un rectángulo del ancho de la
              columna.
            */}
            <span className="segmented-control__pill">
              {option.icon ? (
                <span className="segmented-control__icon" aria-hidden>
                  <Icon name={option.icon} size={12} />
                </span>
              ) : null}
              <span className="segmented-control__label">{option.label}</span>
              {option.indicator ? (
                <span className="segmented-control__dot" aria-hidden />
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
