import { DEFAULT_COLLAPSED_DIR_NAMES } from '@shared/fileExplorerHiddenDirs'

export { DEFAULT_COLLAPSED_DIR_NAMES }

/** Clave estable para comparar listas de carpetas expandidas sin depender de la referencia del array. */
export function expandedPathsKey(paths: string[]): string {
  return paths.filter(Boolean).sort().join('\0')
}

/** Normaliza cwd de sesión para comparar sin disparar refrescos duplicados. */
export function normalizeSessionCwd(cwd: string | null | undefined): string {
  if (!cwd) return ''
  return cwd.trim().replace(/\\/g, '/').replace(/\/+$/, '') || ''
}

/** Etiqueta corta para la barra del panel: últimos N segmentos (`padre / actual`). */
export function sessionCwdPaneLabel(cwd: string | null | undefined, levels = 2): string {
  const norm = normalizeSessionCwd(cwd)
  if (!norm) return '—'
  const parts = norm.split('/').filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0]!
  return parts.slice(-levels).join(' / ')
}

/** Solo el basename de la carpeta actual del cwd (sin padres). */
export function sessionCwdFolderName(cwd: string | null | undefined): string {
  const norm = normalizeSessionCwd(cwd)
  if (!norm) return '—'
  const parts = norm.split('/').filter(Boolean)
  return parts[parts.length - 1] || '—'
}

export interface ExplorerSelectedEntry {
  relPath: string
  isDirectory: boolean
}

/** Carpeta padre para crear entradas según la selección actual. */
export function parentDirForCreate(
  selectedPath: string | null,
  isDirectory?: boolean,
): string {
  if (!selectedPath) return ''
  if (isDirectory) return selectedPath
  const idx = selectedPath.lastIndexOf('/')
  return idx === -1 ? '' : selectedPath.slice(0, idx)
}

function isValidPathSegment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return false
  // Rechazar solo caracteres que el sistema de archivos no permite (nul, / en todos los SO; : en Windows)
  return !/[\x00/]/.test(segment)
}

/** Valida y combina nombre con carpeta padre; devuelve ruta relativa o null. */
export function buildNewRelPath(nameRaw: string, parentPath: string): string | null {
  const name = nameRaw.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!name || name.includes('..')) return null
  if (name.startsWith('/')) return null
  const segments = name.split('/').filter(Boolean)
  if (segments.some(s => !isValidPathSegment(s))) return null
  const rel = parentPath ? `${parentPath}/${name}` : name
  return rel.replace(/\/+/g, '/')
}

/** Directorio padre de una ruta relativa. */
export function parentRelPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

/** Carpeta destino al pegar: carpeta seleccionada o padre del archivo. */
export function pasteDestRelPath(selected: ExplorerSelectedEntry | null): string {
  if (!selected) return ''
  if (selected.isDirectory) return selected.relPath
  return parentDirForCreate(selected.relPath)
}

/** Remapea una ruta relativa tras renombrar un prefijo (carpeta o archivo). */
export function remapChildRelPath(
  relPath: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (relPath === oldPrefix) return newPrefix
  const childPrefix = `${oldPrefix}/`
  if (relPath.startsWith(childPrefix)) {
    return `${newPrefix}${relPath.slice(oldPrefix.length)}`
  }
  return null
}

/** True si child está dentro de parent o es el mismo (rutas relativas). */
export function isRelPathInside(parent: string, child: string): boolean {
  if (parent === child) return true
  if (!parent) return false
  return child.startsWith(`${parent}/`)
}

/** Ruta relativa de cwd respecto a la raíz del árbol (cwd de sesión). */
export function relPathFromCwd(treeRootCwd: string, sessionCwd: string): string | null {
  const root = normalizeSessionCwd(treeRootCwd)
  const cwd = normalizeSessionCwd(sessionCwd)
  if (!root || !cwd) return null
  if (cwd === root) return ''
  const prefix = `${root}/`
  if (!cwd.startsWith(prefix)) return null
  return cwd.slice(prefix.length)
}

/**
 * Rutas sobre las que opera copy/cut/delete del menú contextual.
 * Si el target no está en la multi-selección, se opera solo sobre el target.
 */
export function resolveExplorerActionPaths(
  multiSelected: ReadonlySet<string> | Iterable<string>,
  contextTargetRelPath: string | null | undefined,
  selectedRelPath: string | null | undefined,
): string[] {
  const multi = multiSelected instanceof Set ? multiSelected : new Set(multiSelected)
  if (multi.size > 0) {
    if (contextTargetRelPath && !multi.has(contextTargetRelPath)) {
      return [contextTargetRelPath]
    }
    return Array.from(multi)
  }
  if (contextTargetRelPath) return [contextTargetRelPath]
  if (selectedRelPath) return [selectedRelPath]
  return []
}

/** True si alguna ruta mutada es el archivo abierto o un ancestro suyo. */
export function pathsAffectOpenFile(
  paths: readonly string[],
  openedRelPath: string | null | undefined,
): boolean {
  if (!openedRelPath) return false
  return paths.some(
    p => openedRelPath === p || openedRelPath.startsWith(`${p}/`),
  )
}

/**
 * Semilla de multi-selección al empezar con ⌘/Ctrl+click:
 * incluye la selección actual si aún no hay multi.
 */
export function seedMultiSelect(
  multiSelected: ReadonlySet<string>,
  selectedRelPath: string | null | undefined,
  clickedRelPath: string,
): Set<string> {
  const next = new Set(multiSelected)
  if (next.size === 0 && selectedRelPath && selectedRelPath !== clickedRelPath) {
    next.add(selectedRelPath)
  }
  if (next.has(clickedRelPath)) next.delete(clickedRelPath)
  else next.add(clickedRelPath)
  return next
}

/** Distancia mínima (px) para tratar un arrastre HTML5 como movimiento real. */
export const EXPLORER_DRAG_MIN_PX = 12

/**
 * Filtra orígenes de un drop: descarta vacío, destino igual a src, carpeta
 * dentro de sí misma y soltar donde el archivo ya vive (padre actual).
 */
export function resolveExplorerMovePaths(
  sources: readonly string[],
  destRelPath: string,
): { movePaths: string[]; intoSelf: boolean } {
  const movePaths: string[] = []
  let intoSelf = false
  for (const src of sources) {
    if (!src) continue
    if (src === destRelPath) continue
    if (isRelPathInside(src, destRelPath)) {
      intoSelf = true
      continue
    }
    if (parentRelPath(src) === destRelPath) continue
    movePaths.push(src)
  }
  return { movePaths, intoSelf }
}

/**
 * True si el puntero se movió al menos `minPx` (euclídea).
 * Coordenadas no finitas → true, para no bloquear un arrastre sin origen.
 */
export function dragExceedsThreshold(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  minPx = EXPLORER_DRAG_MIN_PX,
): boolean {
  if (![startX, startY, endX, endY, minPx].every(Number.isFinite)) return true
  return Math.hypot(endX - startX, endY - startY) >= minPx
}

/** Ancestros de una ruta relativa (sin incluir la propia ruta). */
export function ancestorRelPaths(relPath: string): string[] {
  const parts = relPath.split('/').filter(Boolean)
  if (parts.length <= 1) return []
  const out: string[] = []
  let acc = ''
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]!}` : parts[i]!
    out.push(acc)
  }
  return out
}

/**
 * Al filtrar, conservar filas match y sus ancestros ya presentes en el árbol
 * para no aplanar el contexto.
 */
export function filterRowsKeepingAncestors<T extends { entry: { relPath: string; name: string } }>(
  rows: T[],
  queryLower: string,
): T[] {
  if (!queryLower) return rows
  const matchPaths = new Set<string>()
  for (const row of rows) {
    const { name, relPath } = row.entry
    if (name.toLowerCase().includes(queryLower) || relPath.toLowerCase().includes(queryLower)) {
      matchPaths.add(relPath)
      for (const a of ancestorRelPaths(relPath)) matchPaths.add(a)
    }
  }
  return rows.filter(r => matchPaths.has(r.entry.relPath))
}
