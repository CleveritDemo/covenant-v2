import { describe, it, expect } from 'vitest'
import { classifyUpdateError } from '../updateErrorKind'
import { formatReleaseNotes, shouldScheduleSilentUpdateChecks } from '../updateState'

describe('formatReleaseNotes', () => {
  it('devuelve null cuando no hay notas', () => {
    expect(formatReleaseNotes(null)).toBeNull()
    expect(formatReleaseNotes(undefined)).toBeNull()
    expect(formatReleaseNotes('   ')).toBeNull()
    expect(formatReleaseNotes([])).toBeNull()
    expect(formatReleaseNotes([{ version: '1.0.0', note: '  ' }])).toBeNull()
  })

  it('pasa el Markdown del yml tal cual', () => {
    expect(formatReleaseNotes('## v1\n\n- algo')).toBe('## v1\n\n- algo')
  })

  it('concatena las entradas del feed con encabezado por versión', () => {
    const out = formatReleaseNotes([
      { version: '0.2.0', note: 'nuevo' },
      { version: '0.1.1', note: null },
      { version: '0.1.0', note: 'viejo' },
    ])
    expect(out).toBe('## 0.2.0\n\nnuevo\n\n## 0.1.0\n\nviejo')
  })
})

describe('classifyUpdateError', () => {
  it('marca desconexión de Chromium como offline', () => {
    expect(classifyUpdateError('net::ERR_INTERNET_DISCONNECTED')).toBe('offline')
  })

  it('marca ENOTFOUND como offline', () => {
    expect(classifyUpdateError('ENOTFOUND api.github.com')).toBe('offline')
  })

  it('marca un fallo de firma como failed', () => {
    expect(classifyUpdateError('Could not get code signature')).toBe('failed')
  })

  it('marca string vacío como failed', () => {
    expect(classifyUpdateError('')).toBe('failed')
  })
})

describe('shouldScheduleSilentUpdateChecks', () => {
  it('solo agenda chequeos silenciosos con el flag ON', () => {
    expect(shouldScheduleSilentUpdateChecks(true)).toBe(true)
    expect(shouldScheduleSilentUpdateChecks(false)).toBe(false)
  })
})
