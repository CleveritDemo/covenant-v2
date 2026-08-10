import { describe, it, expect } from 'vitest'
import { changelogSection, changelogRecentModifications } from '../changelog'

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

describe('changelogRecentModifications', () => {
  it('recorta a 10 bullets cruzando varias versiones y omite el preámbulo', () => {
    const md = `# Changelog

Notas generales.

## v3

- A
- B
- C
- D

## v2

- E
- F
- G
- H

## v1

- I
- J
- K
- L
`
    expect(changelogRecentModifications(md)).toBe(`## v3

- A
- B
- C
- D

## v2

- E
- F
- G
- H

## v1

- I
- J`)
  })

  it('preserva líneas de continuación de cada bullet incluido', () => {
    const md = `## v1.2.0

- **Primero**: línea
  de continuación.
- **Segundo**: corto

## v1.1.0

- **Tercero**: también
  sigue aquí.
- **Cuarto**: sobra
`
    expect(changelogRecentModifications(md, 3)).toBe(`## v1.2.0

- **Primero**: línea
  de continuación.
- **Segundo**: corto

## v1.1.0

- **Tercero**: también
  sigue aquí.`)
  })

  it('con menos de 10 entradas no altera el contenido versionado', () => {
    expect(changelogRecentModifications(MD)).toBe(`## v0.6.2

- Uno
- Dos

## v0.6.1

- Viejo`)
  })
})
