function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

const COMPACT_FROM = 1_000_000

export function formatStat(value: number): string {
  const n = Math.round(value)
  if (n < COMPACT_FROM) return formatNumber(n)
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
