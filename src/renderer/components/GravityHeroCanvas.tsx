import React, { forwardRef } from 'react'
import { Gravity, type GravitySize } from '../agent/Gravity'
import './GravityHeroCanvas.css'

export type GravityHeroCanvasEnter = 'none' | 'fade'

export interface GravityHeroCanvasProps {
  children?: React.ReactNode
  /** Wordmark bajo Gravity. Solo splash de arranque; default false. */
  brand?: boolean
  brandLabel?: string
  gravitySize?: GravitySize
  /** Entrada breve; splash de arranque usa CSS propio. */
  enter?: GravityHeroCanvasEnter
  /**
   * Ajuste de la masa Gravity por altura de viewport.
   * - `fixed` (default): tamaño hero constante.
   * - `shrink`: la masa cede altura en viewports bajos.
   */
  heroFit?: 'fixed' | 'shrink'
  /**
   * Si es `false`, no monta la masa `<Gravity>`.
   * Útil cuando el consumidor aporta su propio campo (p. ej. onboarding).
   * Default `true`.
   */
  showMass?: boolean
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
      brand = false,
      brandLabel = 'COVENANT GRAVITY',
      gravitySize = 'hero',
      enter = 'none',
      heroFit = 'fixed',
      showMass = true,
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
      heroFit === 'shrink' ? 'gravity-hero-canvas--shrink' : '',
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
        {showMass ? <Gravity size={gravitySize} /> : null}
        {brand ? <p className="gravity-hero-canvas__brand">{brandLabel}</p> : null}
        {children}
      </div>
    )
  },
)
