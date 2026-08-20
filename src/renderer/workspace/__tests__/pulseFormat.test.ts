import { describe, expect, it } from 'vitest'
import { formatStat } from '../pulseFormat'

function expectedBelowCompact(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n))
}

function expectedCompact(n: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.round(n))
}

describe('formatStat', () => {
  it('formats zero as an integer', () => {
    expect(formatStat(0)).toBe('0')
  })

  it('formats small values with grouped digits below 1M', () => {
    expect(formatStat(1)).toBe(expectedBelowCompact(1))
    expect(formatStat(999_999)).toBe(expectedBelowCompact(999_999))
  })

  it('switches to compact notation from 1M', () => {
    expect(formatStat(1_000_000)).toBe(expectedCompact(1_000_000))
    expect(formatStat(1_500_000)).toBe(expectedCompact(1_500_000))
    expect(formatStat(52_000_000)).toBe(expectedCompact(52_000_000))
  })

  it('rounds before choosing compact vs grouped format', () => {
    expect(formatStat(999_999.4)).toBe(expectedBelowCompact(999_999))
    expect(formatStat(999_999.6)).toBe(expectedCompact(1_000_000))
  })
})
