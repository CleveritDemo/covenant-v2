import { describe, expect, it } from 'vitest'
import { firstUsefulPromptLine, stripMarkdownForSnippet } from '../promptSnippet'

describe('stripMarkdownForSnippet', () => {
  it.each([
    ['**negrita**', 'negrita'],
    ['*cursiva*', 'cursiva'],
    ['`código`', 'código'],
    ['[texto](https://x.test)', 'texto'],
    ['## Encabezado', 'Encabezado'],
    ['> cita', 'cita'],
    ['- viñeta', 'viñeta'],
    ['1. numerada', 'numerada'],
    ['texto limpio', 'texto limpio'],
  ])('%j → %j', (input, expected) => {
    expect(stripMarkdownForSnippet(input)).toBe(expected)
  })
})

describe('firstUsefulPromptLine', () => {
  it('extrae el objetivo de un bloque de delegación', () => {
    const block = [
      '## Delegation brief',
      'from: tech-lead-copy',
      'to: frontend',
      'round: 1/∞',
      '',
      'Añade un flag offline a las guardas...',
      '',
      'más detalle',
    ].join('\n')
    expect(firstUsefulPromptLine(block)).toBe('Añade un flag offline a las guardas...')
  })

  it('no descarta encabezado markdown de un humano', () => {
    expect(firstUsefulPromptLine('## Arregla el login\nblah')).toBe('Arregla el login')
  })

  it('devuelve cadena vacía para texto vacío o solo saltos', () => {
    expect(firstUsefulPromptLine('')).toBe('')
    expect(firstUsefulPromptLine('\n\n')).toBe('')
  })

  it('quita viñeta del objetivo de un brief', () => {
    const block = [
      '## Delegation brief',
      'to: frontend',
      '',
      '- Implementa el hook de red',
    ].join('\n')
    expect(firstUsefulPromptLine(block)).toBe('Implementa el hook de red')
  })
})
