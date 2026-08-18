/** Cuentas de GitHub persistidas en AppConfig (sin secretos). */

export interface GithubAccount {
  id: string
  label: string
}

const LABEL_MAX = 40

export function sanitizeAccountLabel(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, LABEL_MAX)
}

export function parseGithubAccounts(raw: unknown): GithubAccount[] {
  if (!Array.isArray(raw)) return []
  const out: GithubAccount[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const rec = entry as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const label = sanitizeAccountLabel(rec.label)
    if (!id || !label) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label })
  }
  return out
}
