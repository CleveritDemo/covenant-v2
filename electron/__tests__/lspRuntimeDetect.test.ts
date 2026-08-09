import { describe, expect, it } from 'vitest'
import { extractVersion, pickNewestSatisfying, versionGe } from '../lsp/runtimeDetect'

describe('versionGe', () => {
  it('compara major y minor', () => {
    expect(versionGe('18.19.0', '18')).toBe(true)
    expect(versionGe('20.0.0', '18')).toBe(true)
    expect(versionGe('v18.19.1', '18')).toBe(true) // tolera la v inicial
    expect(versionGe('16.20.0', '18')).toBe(false)
    expect(versionGe('18.0.0', '18.0')).toBe(true)
    expect(versionGe('18.0.0', '18.1')).toBe(false)
  })

  it('devuelve false con basura', () => {
    expect(versionGe('', '18')).toBe(false)
    expect(versionGe('not-a-version', '18')).toBe(false)
  })
})

describe('extractVersion', () => {
  it('saltea un token de vendor inicial (java --version)', () => {
    expect(extractVersion('openjdk 17.0.18 2026-01-20')).toBe('17.0.18')
  })

  it('quita la v inicial cuando el primer token ya es la versión (node)', () => {
    expect(extractVersion('v18.19.0')).toBe('18.19.0')
  })

  it('acepta una versión pelada como primer token (dotnet)', () => {
    expect(extractVersion('10.0.101')).toBe('10.0.101')
  })

  it('devuelve null con basura', () => {
    expect(extractVersion('garbage')).toBeNull()
    expect(extractVersion('')).toBeNull()
  })

  it('lo que extrae de node y dotnet sigue satisfaciendo su mínimo', () => {
    expect(versionGe(extractVersion('v18.19.0') as string, '18')).toBe(true)
    expect(versionGe(extractVersion('10.0.101') as string, '10')).toBe(true)
  })
})

describe('pickNewestSatisfying', () => {
  it('elige la más alta por encima del mínimo', () => {
    const c = [
      { dir: '/a', version: '17.0.18' },
      { dir: '/b', version: '26.0.1' },
      { dir: '/c', version: '21.0.2' },
    ]
    expect(pickNewestSatisfying(c, '21')).toEqual({ dir: '/b', version: '26.0.1' })
  })

  it('ignora las que están bajo el mínimo', () => {
    const c = [
      { dir: '/a', version: '17.0.18' },
      { dir: '/b', version: '20.9.9' },
    ]
    expect(pickNewestSatisfying(c, '21')).toBeNull()
  })

  it('sin candidatos devuelve null', () => {
    expect(pickNewestSatisfying([], '21')).toBeNull()
  })

  it('ordena por versión completa, no sólo por major', () => {
    const c = [
      { dir: '/a', version: '21.0.9' },
      { dir: '/b', version: '21.2.0' },
    ]
    expect(pickNewestSatisfying(c, '21')).toEqual({ dir: '/b', version: '21.2.0' })
  })
})
