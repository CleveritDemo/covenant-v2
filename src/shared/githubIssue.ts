/**
 * Tipos y parseo de issues de GitHub. Puro: lo necesitan los dos lados —
 * `electron/` para materializar el `.md` y el renderer para el picker.
 */

export interface GithubIssueRef {
  number: number
  title: string
  state: 'open' | 'closed'
  repoFullName: string
  /** ISO 8601 de `updated_at`. */
  updated: string
  author: string
  labels: string[]
}

export interface GithubIssueSnapshot extends GithubIssueRef {
  url: string
  body: string
  assignees: string[]
  milestone: string | null
  comments: Array<{ author: string; created: string; body: string }>
}

export interface GithubIssueToken {
  repoFullName?: string
  number: number
}

/**
 * `'123'`, `'#123'` y `'owner/repo#123'`. Cualquier otra forma → `null`.
 */
export function parseGithubIssueToken(raw: string): GithubIssueToken | null {
  const candidate = (raw ?? '').trim()
  if (!candidate) return null
  const withRepo = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/.exec(candidate)
  if (withRepo) return { repoFullName: withRepo[1], number: Number(withRepo[2]) }
  const hashed = /^#(\d+)$/.exec(candidate)
  if (hashed) return { number: Number(hashed[1]) }
  const digits = /^(\d+)$/.exec(candidate)
  if (digits) return { number: Number(digits[1]) }
  return null
}

/**
 * Lo mínimo para saber de qué issue habla un contexto githubIssue.
 * Estructural (no `TabContext`) para que este módulo siga sin importar nada.
 */
export interface GithubIssueRefSource {
  issueNumber?: number
  repoFullName?: string
  fileName?: string
  name?: string
}

function trailingIssueNumber(source: string): number {
  const base = source.replace(/\\/g, '/').split('/').pop() ?? ''
  const stem = base.replace(/\.md$/i, '').trim()
  const match = /-(\d+)$/.exec(stem) || /^(\d+)$/.exec(stem)
  return match ? Number(match[1]) : 0
}

/**
 * La ÚNICA regla de resolución para un contexto githubIssue: `issueNumber` /
 * `repoFullName` explícitos y, si falta el número, SOLO el número del archivo
 * (`github/<owner>-<repo>-<number>.md` → `number`). Un `repoFullName` vacío
 * significa «resolver por el origin del workspace» — este módulo no toca git.
 */
export function githubIssueRefFor(context: GithubIssueRefSource): {
  repoFullName: string
  number: number
} {
  const explicit = typeof context.issueNumber === 'number' && Number.isInteger(context.issueNumber)
    ? context.issueNumber
    : 0
  const number = explicit > 0
    ? explicit
    : trailingIssueNumber(context.fileName || context.name || '')
  return { repoFullName: (context.repoFullName ?? '').trim(), number }
}

/**
 * Stem del archivo bajo `github/`: `owner-repo-number` si hay repo, si no el
 * nombre de archivo ya conocido, si no el número suelto.
 */
export function githubIssueFileStem(context: GithubIssueRefSource): string {
  const { repoFullName, number } = githubIssueRefFor(context)
  if (repoFullName && number > 0) return `${repoFullName.replace(/\//g, '-')}-${number}`
  const source = (context.fileName || context.name || '').trim()
  const base = source.replace(/\\/g, '/').split('/').pop() ?? ''
  const stem = base.replace(/\.md$/i, '').trim()
  if (stem) return stem
  return number > 0 ? String(number) : 'issue'
}
