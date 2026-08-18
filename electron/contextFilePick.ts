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

export function partitionProjectFilePaths(
  root: string,
  absPaths: string[],
): { inside: Array<{ abs: string; rel: string }>; outside: string[] } {
  const rootAbs = resolve(root)
  const inside: Array<{ abs: string; rel: string }> = []
  const outside: string[] = []
  const seenInside = new Set<string>()
  const seenOutside = new Set<string>()
  for (const abs of absPaths) {
    const resolved = resolve(abs)
    const rel = relative(rootAbs, resolved)
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      if (seenOutside.has(resolved)) continue
      seenOutside.add(resolved)
      outside.push(resolved)
      continue
    }
    const normalized = rel.split('\\').join('/')
    if (seenInside.has(normalized)) continue
    seenInside.add(normalized)
    inside.push({ abs: resolved, rel: normalized })
  }
  return { inside, outside }
}
