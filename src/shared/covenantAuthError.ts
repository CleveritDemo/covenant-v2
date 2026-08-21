export function describeCovenantSignInError(
  raw: string,
  source: 'settings' | 'env' | 'keychain' | 'none' | 'account',
  accountLabel?: string,
): string {
  if (raw === 'no-github-token') return raw

  const trimmedAccountLabel = accountLabel?.trim() ?? ''
  const label =
    source === 'account'
      ? trimmedAccountLabel
        ? `la cuenta «${trimmedAccountLabel}» de Ajustes > GitHub`
        : 'Ajustes > GitHub'
      : source === 'settings'
        ? 'Ajustes > GitHub'
        : source === 'env'
          ? 'la variable GITHUB_TOKEN'
          : source === 'keychain'
            ? 'el keychain de git (git credential)'
            : 'origen desconocido'

  const lower = raw.toLowerCase()
  if (lower.includes('unauthorized') || lower.includes('bad credentials') || raw.startsWith('401')) {
    return `GitHub rechazó el token que la app tomó de ${label}: está vencido, revocado o no puede leer tu cuenta. Genera uno nuevo en github.com/settings/tokens y pégalo en Ajustes > GitHub.`
  }

  if (
    raw.startsWith('Covenant respondió con 5') ||
    raw.includes('502') ||
    raw.includes('503') ||
    raw.includes('504')
  ) {
    return `El servidor de Covenant no respondió (${raw}). Reintenta en un momento.`
  }

  return `${raw} (token tomado de ${label})`
}
