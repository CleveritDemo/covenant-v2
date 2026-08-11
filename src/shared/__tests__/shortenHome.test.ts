import { describe, expect, it } from 'vitest'
import { shortenHome } from '../shortenHome'

describe('shortenHome', () => {
  it('sustituye el home por ~ en macOS, Linux y Windows', () => {
    expect(shortenHome('/Users/carlos/Sources/gravity')).toBe('~/Sources/gravity')
    expect(shortenHome('/home/carlos/dev/app')).toBe('~/dev/app')
    expect(shortenHome('C:\\Users\\carlos\\dev\\app')).toBe('~\\dev\\app')
  })

  it('deja intactas las rutas fuera del home', () => {
    expect(shortenHome('/opt/homebrew/var/repo')).toBe('/opt/homebrew/var/repo')
    expect(shortenHome('/Users')).toBe('/Users')
  })

  it('normaliza barras finales y vacíos', () => {
    expect(shortenHome('/Users/carlos/Sources/gravity/')).toBe('~/Sources/gravity')
    expect(shortenHome('   ')).toBe('')
    expect(shortenHome('')).toBe('')
  })

  it('el propio home queda como ~', () => {
    expect(shortenHome('/Users/carlos')).toBe('~')
  })
})
