/**
 * «hace 2 horas», «en 3 días». Puro: recibe el ahora en vez de leer el reloj,
 * así se testea sin congelar tiempo.
 *
 * Vivía duplicado dentro de `PulseModal`; se sacó aquí al necesitarlo también
 * el picker de issues de Jira.
 */
export function relativeTime(ms: number, nowMs: number): string {
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const minutes = Math.round((ms - nowMs) / 60_000)
  if (Math.abs(minutes) < 60) return fmt.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return fmt.format(hours, 'hour')
  return fmt.format(Math.round(hours / 24), 'day')
}

/** ISO 8601 → texto relativo; `''` si la fecha no es utilizable. */
export function relativeTimeFromIso(iso: string, nowMs: number): string {
  const ms = Date.parse(iso ?? '')
  return Number.isNaN(ms) ? '' : relativeTime(ms, nowMs)
}
