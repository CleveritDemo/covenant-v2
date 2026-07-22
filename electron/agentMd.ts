import { basename, join, normalize, resolve } from 'path'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.vite',
  'coverage',
  'target',
  '__pycache__',
  '.turbo',
  '.cache',
  'vendor',
  'Pods',
  '.gradle',
])

/** Profundidad y tamaño del árbol enviado al modelo al generar `agent.md`. */
const TREE_MAX_DEPTH = 18
const TREE_MAX_LINES = 4500

/**
 * Ruta absoluta a `./.ai-terminal/agent.md` respecto al cwd dado.
 */
export function resolveAgentMdPath(cwdRaw: string): string | null {
  let dir: string
  try {
    dir = normalize(resolve(String(cwdRaw).trim()))
  } catch {
    return null
  }
  try {
    const st = statSync(dir)
    if (!st.isDirectory()) return null
  } catch {
    return null
  }
  return join(dir, '.ai-terminal', 'agent.md')
}

export function readAgentMdForCwd(cwdRaw: string): string | null {
  let dir: string
  try {
    dir = normalize(resolve(String(cwdRaw).trim()))
  } catch {
    return null
  }
  try {
    if (!statSync(dir).isDirectory()) return null
  } catch {
    return null
  }
  const pNew = join(dir, '.ai-terminal', 'agent.md')
  if (existsSync(pNew)) {
    try {
      return readFileSync(pNew, 'utf-8')
    } catch {
      return null
    }
  }
  const legacy = join(dir, 'ia-terminal', 'agent.md')
  if (existsSync(legacy)) {
    try {
      const content = readFileSync(legacy, 'utf-8')
      // Migrar a `.ai-terminal/` y dejar de usar la carpeta legacy.
      try {
        mkdirSync(join(dir, '.ai-terminal'), { recursive: true })
        writeFileSync(pNew, content, 'utf-8')
        unlinkSync(legacy)
        try {
          rmdirSync(join(dir, 'ia-terminal'))
        } catch {
          /* carpeta no vacía u otro error */
        }
      } catch {
        /* si falla la migración, al menos devolver el contenido leído */
      }
      return content
    } catch {
      return null
    }
  }
  return null
}

export function writeAgentMdForCwd(
  cwdRaw: string,
  content: string,
): { ok: true } | { ok: false; error: string } {
  const p = resolveAgentMdPath(cwdRaw)
  if (!p) return { ok: false, error: 'invalid cwd' }
  try {
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, 'utf-8')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/**
 * Árbol solo de carpetas/subcarpetas del proyecto (indentado).
 * Omite carpetas pesadas (`node_modules`, `.git`, artefactos de build, etc.).
 * No incluye archivos.
 */
export function gatherShallowFolderTree(cwdRaw: string): string {
  let root: string
  try {
    root = normalize(resolve(String(cwdRaw).trim()))
  } catch {
    return '(invalid cwd)'
  }
  let st: ReturnType<typeof statSync>
  try {
    st = statSync(root)
  } catch {
    return '(could not read directory)'
  }
  if (!st.isDirectory()) return '(not a directory)'

  const label = basename(root) || 'proyecto'
  const lines: string[] = [
    `${label}/  (project root; paths are relative to this folder)`,
    '',
  ]

  function walk(dir: string, depth: number, relPrefix: string, indent: string): void {
    if (lines.length >= TREE_MAX_LINES || depth > TREE_MAX_DEPTH) return
    let dirents: import('fs').Dirent[]
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    const dirs = dirents.filter(
      e =>
        e.isDirectory() &&
        !e.name.startsWith('.') &&
        !SKIP_DIRS.has(e.name),
    )

    dirs.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )

    for (const e of dirs) {
      if (lines.length >= TREE_MAX_LINES) {
        lines.push(`${indent}… (truncated: line limit)`)
        return
      }
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name
      lines.push(`${indent}${rel}/`)
      walk(join(dir, e.name), depth + 1, rel, `${indent}  `)
    }
  }

  walk(root, 0, '', '')
  return lines.join('\n')
}
