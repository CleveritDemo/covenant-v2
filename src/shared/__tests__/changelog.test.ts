import { describe, it, expect } from 'vitest'
import { changelogSection } from '../changelog'

const MD = `# Changelog

Preámbulo.

## v0.6.2

- Uno
- Dos

## v0.6.1

- Viejo
`

describe('changelogSection', () => {
  it('devuelve solo el cuerpo de la versión pedida', () => {
    expect(changelogSection(MD, '0.6.2')).toBe('- Uno\n- Dos')
  })

  it('corta en el último encabezado sin dejarse líneas', () => {
    expect(changelogSection(MD, '0.6.1')).toBe('- Viejo')
  })

  it('devuelve null si la versión no está o viene vacía', () => {
    expect(changelogSection(MD, '9.9.9')).toBeNull()
    expect(changelogSection('## v1.0.0\n\n## v0.9.0\n\n- x', '1.0.0')).toBeNull()
  })
})
