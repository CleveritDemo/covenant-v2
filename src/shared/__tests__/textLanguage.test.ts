import { describe, expect, it } from 'vitest'
import { detectTextLanguage } from '../textLanguage'

describe('detectTextLanguage', () => {
  it('detects Spanish from a long MVP objective', () => {
    expect(detectTextLanguage(
      'Necesito que revisen que tenemos implementado y que va faltando como características necesarias para un MVP de loyalty generico para bancos',
    )).toBe('es')
  })

  it('detects English from a long MVP objective', () => {
    expect(detectTextLanguage(
      'Review what we have implemented and what features are still missing for a generic loyalty MVP for banks',
    )).toBe('en')
  })

  it('keeps Spanish when English identifiers and paths are present', () => {
    expect(detectTextLanguage(
      'Necesito revisar el pipeline de evaluación en server/src/pipeline.rs y el endpoint GET /v1/loyalty-profile antes del MVP',
    )).toBe('es')
  })

  it('returns null for empty or whitespace-only input', () => {
    expect(detectTextLanguage('')).toBeNull()
    expect(detectTextLanguage('   ')).toBeNull()
  })

  it('returns null when only a file path remains after cleaning', () => {
    expect(detectTextLanguage('server/src/pipeline.rs')).toBeNull()
  })

  it('does not flip to English when a code block inside Spanish is English', () => {
    expect(detectTextLanguage(
      'Necesito revisar la implementación actual. ```function reviewFeatures() { return "the features we need are missing"; }``` ¿Qué falta todavía?',
    )).toBe('es')
  })
})
