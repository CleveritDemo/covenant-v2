/**
 * Parser de diff unificado (`git diff`) a hunks y líneas numeradas, para pintarlo
 * en la UI. Pura y compartida: main solo ejecuta git y devuelve el texto.
 */

export type GitDiffLineKind = 'add' | 'del' | 'context' | 'meta'

export interface GitDiffLine {
  kind: GitDiffLineKind
  /** Texto sin el prefijo +/−/espacio. */
  text: string
  /** Número en el archivo antiguo, o null si la línea no existe allí. */
  oldLine: number | null
  /** Número en el archivo nuevo, o null si la línea no existe allí. */
  newLine: number | null
}

export interface GitDiffHunk {
  /** Cabecera `@@ -a,b +c,d @@` con su posible sufijo de contexto. */
  header: string
  lines: GitDiffLine[]
}

export interface GitFileDiff {
  hunks: GitDiffHunk[]
  /** `Binary files … differ`: no hay líneas que enseñar. */
  binary: boolean
  insertions: number
  deletions: number
}

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parseGitUnifiedDiff(text: string): GitFileDiff {
  const hunks: GitDiffHunk[] = []
  let current: GitDiffHunk | null = null
  let oldLine = 0
  let newLine = 0
  let binary = false
  let insertions = 0
  let deletions = 0

  for (const raw of text.split('\n')) {
    const hunkMatch = HUNK_RE.exec(raw)
    if (hunkMatch) {
      current = { header: raw, lines: [] }
      hunks.push(current)
      oldLine = Number.parseInt(hunkMatch[1] ?? '0', 10)
      newLine = Number.parseInt(hunkMatch[2] ?? '0', 10)
      continue
    }

    if (!current) {
      // Preámbulo: `diff --git`, `index`, `---`, `+++`, modos… nada que pintar.
      if (raw.startsWith('Binary files ') || raw.startsWith('GIT binary patch')) binary = true
      continue
    }

    if (raw.startsWith('\\')) {
      // `\ No newline at end of file`
      current.lines.push({ kind: 'meta', text: raw.slice(2), oldLine: null, newLine: null })
      continue
    }

    const marker = raw[0] ?? ''
    const body = raw.slice(1)
    if (marker === '+') {
      current.lines.push({ kind: 'add', text: body, oldLine: null, newLine: newLine++ })
      insertions++
    } else if (marker === '-') {
      current.lines.push({ kind: 'del', text: body, oldLine: oldLine++, newLine: null })
      deletions++
    } else if (marker === ' ') {
      current.lines.push({ kind: 'context', text: body, oldLine: oldLine++, newLine: newLine++ })
    }
    // Cualquier otra cosa (línea vacía final, basura) se ignora.
  }

  return { hunks, binary, insertions, deletions }
}
