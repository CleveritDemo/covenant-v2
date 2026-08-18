import type { GithubAccount } from '../src/shared/githubAccounts'

export type ResolvedCovenantAccount =
  | { ok: true; accountId: string }
  | { ok: false; error: 'unknown-account' }

/** Trim; vacío → defaultAccountId; eso vacío → 'default'. Id distinto de 'default' ausente del llavero → error. */
export function resolveCovenantAccountId(
  raw: unknown,
  config: { githubDefaultAccountId?: string; githubAccounts?: GithubAccount[] } = {},
): ResolvedCovenantAccount {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const accountId = trimmed || (config.githubDefaultAccountId ?? '').trim() || 'default'
  if (accountId !== 'default' && !(config.githubAccounts ?? []).some(account => account.id === accountId)) {
    return { ok: false, error: 'unknown-account' }
  }
  return { ok: true, accountId }
}
