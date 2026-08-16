/**
 * Lint de wiki para prompts del curador y del barrido. Extraído de wikiCurator.ts
 * para evitar dependencia circular con wikiCuratorSweep.
 */

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { lintWikiPages } from '../src/shared/wikiLint'
import { readWikiPages } from './wikiStore'

/**
 * Las pages citan rutas relativas a su paquete (`electron/…`, `src/…`) pero el
 * cwd del proyecto puede ser un monorepo con esos paquetes un nivel abajo
 * (covenant-v2/electron/…), o relativas a raíces aún más profundas
 * (`locales/en.ts` bajo src/i18n). Regla precision-first: la ruta cuenta como
 * viva si existe bajo cwd o bajo una subcarpeta visible de primer nivel, y
 * solo se acusa como muerta si su primer segmento ancla en alguna raíz — una
 * ruta sin anclaje no es verificable y no se reporta.
 */
function buildWikiPathExists(cwd: string): (rel: string) => boolean {
  let roots: string[] | null = null
  const listRoots = (): string[] => {
    if (roots) return roots
    roots = [cwd]
    try {
      for (const entry of readdirSync(cwd, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        roots.push(join(cwd, entry.name))
      }
    } catch { /* cwd ilegible: queda solo cwd */ }
    return roots
  }
  return rel => {
    const allRoots = listRoots()
    if (allRoots.some(root => existsSync(join(root, rel)))) return true
    const first = rel.split('/')[0] ?? ''
    return !allRoots.some(root => existsSync(join(root, first)))
  }
}

/** Sección `## Wiki health` para el prompt del curador; undefined si la wiki está sana. */
export function buildWikiHealthSection(cwd: string): string | undefined {
  const report = lintWikiPages(readWikiPages(cwd), buildWikiPathExists(cwd))
  const lines = [
    ...report.orphans.map(slug => `- orphan page: [[${slug}]]`),
    ...report.brokenLinks.map(({ from, to }) => `- broken link: [[${from}]] → [[${to}]]`),
    ...report.deadPaths.map(({ slug, path }) => `- dead file path in [[${slug}]]: \`${path}\``),
  ]
  return lines.length ? lines.join('\n') : undefined
}
