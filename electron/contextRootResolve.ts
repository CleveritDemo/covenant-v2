import { isAbsolute, relative, resolve } from 'path'

export type ContextRootResolution =
  | { ok: true; root: string; rebasedUnder?: string }
  | { ok: false; reason: 'not-found' | 'ambiguous' }

function escapesCwd(cwd: string, abs: string): boolean {
  const rel = relative(resolve(cwd), abs)
  return rel.startsWith('..') || isAbsolute(rel)
}

/**
 * Resuelve la carpeta raíz de un contexto bajo cwd.
 * Si rootPath no existe arriba, prueba un nivel (repos del workspace org).
 * Nunca cae en silencio a cwd: not-found o ambiguous.
 */
export function resolveContextRoot(args: {
  cwd: string
  rootPath?: string
  exists: (abs: string) => boolean
  listDirs: (abs: string) => string[]
}): ContextRootResolution {
  const base = resolve(args.cwd)
  const trimmed = (args.rootPath ?? '').trim()

  // 1. Vacío o '.' → la raíz del workspace.
  if (!trimmed || trimmed === '.') {
    return { ok: true, root: base }
  }

  const candidate = resolve(base, trimmed)
  const candidateEscapes = escapesCwd(base, candidate)

  // 2–3. Ruta exacta bajo cwd (si no escapa).
  if (!candidateEscapes && args.exists(candidate)) {
    return { ok: true, root: candidate }
  }

  // 4. Re-base de un nivel bajo cada subcarpeta inmediata.
  const matches: Array<{ root: string; sub: string }> = []
  for (const sub of [...args.listDirs(base)].sort((a, b) => a.localeCompare(b))) {
    const under = resolve(base, sub, trimmed)
    if (!args.exists(under)) continue
    if (escapesCwd(base, under)) continue
    matches.push({ root: under, sub })
  }

  if (matches.length === 1) {
    return { ok: true, root: matches[0].root, rebasedUnder: matches[0].sub }
  }
  if (matches.length >= 2) {
    return { ok: false, reason: 'ambiguous' }
  }
  return { ok: false, reason: 'not-found' }
}
