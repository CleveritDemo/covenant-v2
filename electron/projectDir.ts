import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { LEGACY_PROJECT_DIR, PROJECT_DIR } from '../src/shared/projectDir'

/**
 * Carpeta del proyecto para este cwd: `.gravity`, salvo que el proyecto ya use
 * `.iaterminal` y no tenga `.gravity`.
 *
 * No se migra en disco: la carpeta vive en el repo del usuario y puede estar
 * commiteada y compartida con su equipo, así que renombrarla es decisión suya.
 * Devuelve siempre una sola — lectura y escritura usan la misma — para que un
 * proyecto no acabe partido entre las dos.
 */
export function projectDirName(cwd: string): string {
  const root = resolve(cwd)
  if (existsSync(join(root, PROJECT_DIR))) return PROJECT_DIR
  return existsSync(join(root, LEGACY_PROJECT_DIR)) ? LEGACY_PROJECT_DIR : PROJECT_DIR
}

/** Ruta absoluta a la carpeta del proyecto, o a un descendiente suyo. */
export function projectDirPath(cwd: string, ...segments: string[]): string {
  return join(resolve(cwd), projectDirName(cwd), ...segments)
}
