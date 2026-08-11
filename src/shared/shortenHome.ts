/**
 * `/Users/x/Sources/app` → `~/Sources/app`; el home completo no aporta nada y
 * ensancha cualquier cosa que muestre la ruta (tooltips, chips, cabeceras).
 */
export function shortenHome(cwd: string): string {
  const path = cwd.trim().replace(/[\\/]+$/, '')
  if (!path) return ''
  const home = path.match(/^(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\\/]+/)
  return home ? `~${path.slice(home[0].length)}` : path
}
