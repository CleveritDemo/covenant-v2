import { dirname, join } from 'path'
import { existsSync, readdirSync } from 'fs'

/**
 * ¿`dir` contiene una entrada que matchea `marker`? Un marcador que empieza con
 * `*` (p. ej. `*.sln`) es un glob de sufijo simple contra los hijos directos —
 * los root markers sólo necesitan "algún archivo con esta extensión", nunca
 * sintaxis glob completa. Cualquier otro se matchea por nombre exacto.
 */
function markerMatches(dir: string, marker: string): boolean {
  if (marker.startsWith('*')) {
    const suffix = marker.slice(1)
    try {
      return readdirSync(dir).some(name => name.endsWith(suffix))
    } catch {
      return false
    }
  }
  try {
    return existsSync(join(dir, marker))
  } catch {
    return false
  }
}

/** Ancestros de `dir` incluyéndolo, desde el más profundo hasta la raíz. */
function ancestors(dir: string): string[] {
  const out: string[] = []
  let current = dir
  for (;;) {
    out.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return out
}

/**
 * Ancestro más EXTERNO que contiene algún marcador; si no hay, el ancestro más
 * cercano con `.git`; si tampoco, el directorio padre del archivo.
 */
export function detectRoot(filePath: string, markers: string[]): string {
  const start = dirname(filePath)
  let markerHit: string | null = null
  let gitHit: string | null = null

  for (const dir of ancestors(start)) {
    if (markers.some(m => markerMatches(dir, m))) {
      markerHit = dir // seguimos subiendo: gana el más externo
    }
    if (gitHit === null && existsSync(join(dir, '.git'))) {
      gitHit = dir
    }
  }
  return markerHit ?? gitHit ?? start
}
