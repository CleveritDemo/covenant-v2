/**
 * Nombre de la carpeta del proyecto donde viven agentes, contextos, results,
 * brainstorms y el changelog. Vive en el repo del usuario, no en userData.
 */
export const PROJECT_DIR = '.gravity'

/**
 * Nombre anterior al rebrand a Covenant Gravity. Los proyectos que ya lo tienen
 * siguen usándolo; ver `projectDirName()` en `electron/projectDir.ts`.
 */
export const LEGACY_PROJECT_DIR = '.iaterminal'

/** Los dos nombres — para ignore-lists de escaneo y filtros de rutas relativas. */
export const PROJECT_DIRS: readonly string[] = [PROJECT_DIR, LEGACY_PROJECT_DIR]
