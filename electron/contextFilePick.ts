import { isAbsolute, relative, resolve } from 'path'

export function relativeProjectFilePaths(
  root: string,
  absPaths: string[],
): { ok: true; paths: string[] } | { ok: false; error: 'outside project folder' } {
  const rootAbs = resolve(root)
  const paths: string[] = []
  const seen = new Set<string>()
  for (const abs of absPaths) {
    const rel = relative(rootAbs, resolve(abs))
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      return { ok: false, error: 'outside project folder' }
    }
    const normalized = rel.split('\\').join('/')
    if (seen.has(normalized)) continue
    seen.add(normalized)
    paths.push(normalized)
  }
  if (paths.length === 0) {
    return { ok: false, error: 'outside project folder' }
  }
  return { ok: true, paths }
}
