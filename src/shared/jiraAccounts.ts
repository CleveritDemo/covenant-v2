/** Cuentas de Jira persistidas en AppConfig (sin secretos). */

import { normalizeJiraSite } from './jiraConfig'

export interface JiraAccount {
  id: string
  label: string
  site: string
  email: string
}

const LABEL_MAX = 40

export function sanitizeJiraAccountLabel(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, LABEL_MAX)
}

export function parseJiraAccounts(raw: unknown): JiraAccount[] {
  if (!Array.isArray(raw)) return []
  const out: JiraAccount[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const rec = entry as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const label = sanitizeJiraAccountLabel(rec.label)
    const site = normalizeJiraSite(rec.site)
    const email = typeof rec.email === 'string' ? rec.email.trim() : ''
    if (!id || !label || !site || !email) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label, site, email })
  }
  return out
}
