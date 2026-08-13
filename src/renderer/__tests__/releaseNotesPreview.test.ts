import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearUpdateBannerPreview,
  getReleaseNotesPreviewToken,
  previewReleaseNotes,
  subscribeUpdateBannerPreview,
} from '../updateBannerPreview'

beforeEach(() => {
  clearUpdateBannerPreview()
})

describe('previewReleaseNotes', () => {
  it('avisa a quien escucha para que abra el modal', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeUpdateBannerPreview(listener)
    previewReleaseNotes()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('el token avanza en cada petición', () => {
    // Es un contador y no un booleano a propósito: pulsar el botón otra vez
    // tiene que reabrir el modal aunque nadie lo haya cerrado en medio.
    const before = getReleaseNotesPreviewToken()
    previewReleaseNotes()
    previewReleaseNotes()
    expect(getReleaseNotesPreviewToken()).toBe(before + 2)
  })

  it('no se mete con el preview del chip: no deja estado de update', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeUpdateBannerPreview(listener)
    previewReleaseNotes()
    // Cancelar el preview del chip no debe deshacer la petición de notas.
    clearUpdateBannerPreview()
    const after = getReleaseNotesPreviewToken()
    previewReleaseNotes()
    expect(getReleaseNotesPreviewToken()).toBe(after + 1)
    unsubscribe()
  })
})
