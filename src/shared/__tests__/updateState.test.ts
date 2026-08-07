import { describe, it, expect } from 'vitest'
import { formatReleaseNotes } from '../updateState'

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
