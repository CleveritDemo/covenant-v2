/** `.gravity/github.json`: qué cuenta del llavero usa este workspace. Sin secretos. */

export function parseWorkspaceAccount(raw: unknown): { accountId: string } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = typeof (raw as { accountId?: unknown }).accountId === 'string'
    ? (raw as { accountId: string }).accountId.trim()
    : ''
  if (!id) return null
  return { accountId: id }
}
