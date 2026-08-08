import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseInstalledPlugins, type InstalledPluginEntry } from '@shared/installedPlugins'

/**
 * Inventario de plugins del harness. Si el archivo no existe o está corrupto,
 * devuelve vacío: un agente sin plugins resolubles arranca sin ninguno, que es
 * el default seguro, en vez de fallar el turno.
 */
export function readInstalledPlugins(home: string): InstalledPluginEntry[] {
  const path = join(home, '.claude', 'plugins', 'installed_plugins.json')
  if (!existsSync(path)) return []
  try {
    return parseInstalledPlugins(JSON.parse(readFileSync(path, 'utf8')) as unknown)
  } catch {
    return []
  }
}
