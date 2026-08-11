import React, { forwardRef } from 'react'
import { Gravity, type GravitySize } from '../agent/Gravity'
import './GravityHeroCanvas.css'

export type GravityHeroCanvasEnter = 'none' | 'fade'

export interface GravityHeroCanvasProps {
  children?: React.ReactNode
  /** Wordmark bajo Gravity. Default true. */
  brand?: boolean
  brandLabel?: string
  gravitySize?: GravitySize
  /** Entrada breve; splash de arranque usa CSS propio. */
  enter?: GravityHeroCanvasEnter
  /** Publica --gravity-hero-canvas-z. */
  zIndex?: number
  role?: React.AriaRole
  tabIndex?: number
  'aria-modal'?: boolean | 'true' | 'false'
  'aria-busy'?: boolean | 'true' | 'false'
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-label'?: string
}

/**
 * Lienzo a pantalla completa: fondo radial, masa Gravity y marca.
 * Misma gramática que `#splash` en index.html.
 */
export const GravityHeroCanvas = forwardRef<HTMLDivElement, GravityHeroCanvasProps>(
  function GravityHeroCanvas(
    {
      children,
      brand = true,
      brandLabel = 'COVENANT GRAVITY',
      gravitySize = 'hero',
      enter = 'none',
      zIndex,
      role,
      tabIndex,
      'aria-modal': ariaModal,
      'aria-busy': ariaBusy,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-label': ariaLabel,
    },
    ref,
  ) {
    const className = [
      'gravity-hero-canvas',
      enter === 'fade' ? 'gravity-hero-canvas--enter-fade' : '',
    ].filter(Boolean).join(' ')

    const style: React.CSSProperties | undefined = typeof zIndex === 'number'
      ? { '--gravity-hero-canvas-z': zIndex } as React.CSSProperties
      : undefined

    return (
      <div
        ref={ref}
        className={className}
        style={style}
        role={role}
        tabIndex={tabIndex}
        aria-modal={ariaModal}
        aria-busy={ariaBusy}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
      >
        <Gravity size={gravitySize} />
        {brand ? <p className="gravity-hero-canvas__brand">{brandLabel}</p> : null}
        {children}
      </div>
    )
  },
)
