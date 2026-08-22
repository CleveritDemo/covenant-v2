import { describe, expect, it } from 'vitest'
import { findPreviewMentions } from '../previewMentions'

describe('findPreviewMentions', () => {
  it('detecta la mención del chat real con backticks', () => {
    const text =
      'Preview: `.gravity/previews/2026-08-21-historial-hilos.html`'
    expect(findPreviewMentions(text)).toEqual([
      {
        fileName: '2026-08-21-historial-hilos.html',
        raw: '.gravity/previews/2026-08-21-historial-hilos.html',
      },
    ])
  })

  it('detecta ruta absoluta con el match completo', () => {
    const text = '/Users/x/proj/.gravity/previews/a.html'
    expect(findPreviewMentions(text)).toEqual([
      {
        fileName: 'a.html',
        raw: '/Users/x/proj/.gravity/previews/a.html',
      },
    ])
  })

  it('devuelve dos menciones distintas en orden de aparición', () => {
    const text =
      'Ver `.gravity/previews/a.html` y luego `.gravity/previews/b.svg`'
    expect(findPreviewMentions(text)).toEqual([
      { fileName: 'a.html', raw: '.gravity/previews/a.html' },
      { fileName: 'b.svg', raw: '.gravity/previews/b.svg' },
    ])
  })

  it('deduplica la misma mención repetida', () => {
    const text =
      '.gravity/previews/x.html .gravity/previews/x.html .gravity/previews/x.html'
    expect(findPreviewMentions(text)).toEqual([
      { fileName: 'x.html', raw: '.gravity/previews/x.html' },
    ])
  })

  it('descarta rutas con .. en el segmento de previews', () => {
    const text = '.gravity/previews/../secret.html'
    expect(findPreviewMentions(text)).toEqual([])
  })

  it('devuelve [] cuando no hay menciones', () => {
    expect(findPreviewMentions('solo texto sin artefactos')).toEqual([])
    expect(findPreviewMentions('')).toEqual([])
  })
})
