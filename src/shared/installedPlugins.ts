/**
 * Lectura del inventario de plugins del harness.
 *
 * La ruta de instalación lleva la versión dentro
 * (`…/cache/<marketplace>/<plugin>/<version>`), así que **no se puede
 * construir**: un upgrade del plugin la cambia. Se lee siempre del
 * `installed_plugins.json`, que es el índice que mantiene el propio harness.
 *
 * Puro: sin `fs`. Quien lo lea de disco vive en `electron/pluginDirs.ts`.
 */

export interface InstalledPluginEntry {
  /** Nombre del plugin, que es el namespace de sus skills (`superpowers`). */
  name: string
  marketplace: string
  installPath: string
  /** `user` | `project` | `local`, tal como lo escribe el harness. */
  scope: string
}

export function parseInstalledPlugins(raw: unknown): InstalledPluginEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const plugins = (raw as Record<string, unknown>).plugins
  if (!plugins || typeof plugins !== 'object') return []

  const out: InstalledPluginEntry[] = []
  for (const [key, value] of Object.entries(plugins as Record<string, unknown>)) {
    const at = key.lastIndexOf('@')
    if (at <= 0) continue
    const name = key.slice(0, at)
    const marketplace = key.slice(at + 1)
    if (!name || !marketplace || !Array.isArray(value)) continue
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      if (typeof entry.installPath !== 'string' || !entry.installPath.trim()) continue
      out.push({
        name,
        marketplace,
        installPath: entry.installPath,
        scope: typeof entry.scope === 'string' ? entry.scope : 'user',
      })
    }
  }
  return out
}

/**
 * Rutas de los namespaces pedidos, en ese orden, sin duplicados.
 *
 * Si un namespace está instalado bajo múltiples marketplaces, devuelve todas
 * las rutas. Elegir una en silencio sería peor —el usuario no vería cuál se
 * descartó. La deduplicación es por `installPath`, no por `name`.
 */
export function resolvePluginDirs(
  namespaces: readonly string[],
  installed: readonly InstalledPluginEntry[],
): string[] {
  const dirs: string[] = []
  for (const namespace of namespaces) {
    for (const entry of installed) {
      if (entry.name !== namespace) continue
      if (!dirs.includes(entry.installPath)) dirs.push(entry.installPath)
    }
  }
  return dirs
}
