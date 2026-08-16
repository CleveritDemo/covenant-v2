import { afterEach, describe, expect, it } from 'vitest'
import {
  clearWikiCuratorActive,
  clearWikiCuratorActiveForTests,
  isWikiCuratorActive,
  markWikiCuratorActive,
} from '../wikiCuratorActive'

describe('wikiCuratorActive registry', () => {
  afterEach(() => {
    clearWikiCuratorActiveForTests()
  })

  it('marca y consulta un cwd activo', () => {
    const cwd = '/proj/a'
    expect(isWikiCuratorActive(cwd)).toBe(false)
    markWikiCuratorActive(cwd)
    expect(isWikiCuratorActive(cwd)).toBe(true)
  })

  it('limpia un cwd marcado', () => {
    const cwd = '/proj/b'
    markWikiCuratorActive(cwd)
    clearWikiCuratorActive(cwd)
    expect(isWikiCuratorActive(cwd)).toBe(false)
  })

  it('hace trim de cwd con espacios', () => {
    markWikiCuratorActive('  /proj/c  ')
    expect(isWikiCuratorActive('/proj/c')).toBe(true)
    expect(isWikiCuratorActive('  /proj/c  ')).toBe(true)
  })

  it('cwd vacío devuelve false', () => {
    markWikiCuratorActive('')
    markWikiCuratorActive('   ')
    expect(isWikiCuratorActive('')).toBe(false)
    expect(isWikiCuratorActive('   ')).toBe(false)
  })

  it('aisla dos cwd distintos', () => {
    markWikiCuratorActive('/proj/one')
    expect(isWikiCuratorActive('/proj/one')).toBe(true)
    expect(isWikiCuratorActive('/proj/two')).toBe(false)
  })
})
