/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { hasNativeScrollAncestor } from '../planeWheelTargets'

/**
 * jsdom no hace layout: `scrollHeight`/`clientHeight` son siempre 0. Se fijan a
 * mano porque lo que se prueba es la REGLA («declara overflow y además se
 * desborda»), no la medición del navegador.
 */
function size(el: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
}

function build(): { plane: HTMLElement; overlay: HTMLElement; row: HTMLElement } {
  const plane = document.createElement('div')
  const overlay = document.createElement('div')
  const row = document.createElement('button')
  overlay.appendChild(row)
  plane.appendChild(overlay)
  document.body.appendChild(plane)
  return { plane, overlay, row }
}

afterEach(() => { document.body.innerHTML = '' })

describe('hasNativeScrollAncestor', () => {
  it('un desplegable con scroll real se queda la rueda', () => {
    const { plane, overlay, row } = build()
    overlay.style.overflowY = 'auto'
    size(overlay, 400, 200)
    expect(hasNativeScrollAncestor(row, plane)).toBe(true)
  })

  it('overflow declarado pero contenido que cabe: la rueda es del plano', () => {
    // Sin esta distinción, cualquier contenedor con `overflow-y: auto` y cuatro
    // filas secuestraría el scroll de las columnas de agentes.
    const { plane, overlay, row } = build()
    overlay.style.overflowY = 'auto'
    size(overlay, 200, 200)
    expect(hasNativeScrollAncestor(row, plane)).toBe(false)
  })

  it('sin overflow declarado, aunque se desborde, la rueda es del plano', () => {
    const { plane, overlay, row } = build()
    size(overlay, 400, 200)
    expect(hasNativeScrollAncestor(row, plane)).toBe(false)
  })

  it('no mira por encima de la raíz del plano', () => {
    // El propio lienzo puede desbordarse; si se contara, el plano nunca
    // scrollearía sus columnas.
    const { plane, row } = build()
    plane.style.overflowY = 'auto'
    size(plane, 4000, 500)
    expect(hasNativeScrollAncestor(row, plane)).toBe(false)
  })

  it('sin target no revienta', () => {
    const { plane } = build()
    expect(hasNativeScrollAncestor(null, plane)).toBe(false)
  })
})
