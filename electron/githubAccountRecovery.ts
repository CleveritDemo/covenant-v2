/** Readopta ids del llavero que ya no están en githubAccounts. Puro: no toca disco. */

import type { GithubAccount } from '@shared/githubAccounts'

export function adoptOrphanAccounts(
  accounts: GithubAccount[],
  defaultAccountId: string,
  storeIds: string[],
): { accounts: GithubAccount[]; defaultAccountId: string; changed: boolean } {
  const known = new Set(accounts.map((a) => a.id))
  const usedLabels = new Set(accounts.map((a) => a.label))
  const next = [...accounts]
  for (const id of storeIds) {
    if (!id || known.has(id)) continue
    let n = 1
    while (usedLabels.has(`Cuenta ${n}`)) n += 1
    const label = `Cuenta ${n}`
    usedLabels.add(label)
    known.add(id)
    next.push({ id, label })
  }
  let nextDefault = defaultAccountId
  if (!nextDefault && next.length > 0) nextDefault = next[0].id
  const changed = next.length !== accounts.length || nextDefault !== defaultAccountId
  return { accounts: next, defaultAccountId: nextDefault, changed }
}
