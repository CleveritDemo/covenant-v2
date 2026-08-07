import { existsSync } from 'fs'
import { resolveSafeProjectPath } from './agentFileOps'
import { projectDirPath } from './projectDir'

export type TabContextRevealResult =
  | { ok: true; absPath: string }
  | { ok: false; error: string }

/**
 * Resuelve el `.md` de un contexto dentro de `<cwd>/<projectDir>` para poder
 * revelarlo en el Finder. `fileName` llega del renderer y no es de fiar.
 *
 * Una comprobación puramente lexicográfica (`resolve` + `relative` + mirar si
 * el resultado empieza por `..`) no es suficiente: no sigue symlinks. Si
 * `.gravity/enlace` es un symlink que apunta fuera del proyecto, esa
 * comprobación ve un descendiente de texto perfectamente válido de
 * `.gravity` y lo deja pasar, aunque el archivo real esté en cualquier otro
 * sitio del disco.
 *
 * Por eso la validación se delega en `resolveSafeProjectPath` (ya usada por
 * el explorador de archivos), que además de rechazar `..`, rutas absolutas,
 * separadores de Windows y bytes nulos, resuelve la ruta final con
 * `realpathSync.native` y comprueba que sigue dentro de la raíz real — el
 * caso de los symlinks queda cubierto ahí.
 */
export function resolveTabContextRevealPath(cwd: string, fileName: string): TabContextRevealResult {
  if (!cwd.trim()) return { ok: false, error: 'cwd vacío' }
  if (!fileName.trim()) return { ok: false, error: 'archivo vacío' }
  const root = projectDirPath(cwd)
  const abs = resolveSafeProjectPath(root, fileName)
  if (!abs) return { ok: false, error: 'ruta fuera del proyecto' }
  if (!existsSync(abs)) return { ok: false, error: 'el archivo no existe todavía' }
  return { ok: true, absPath: abs }
}
