/** Traduce `no-github-token`; el resto del error de auth se muestra tal cual. */
export function mapCovenantAuthError(
  error: string,
  translate: (key: 'organizations.errorNoGithubToken') => string,
): string {
  if (error === 'no-github-token') return translate('organizations.errorNoGithubToken')
  return error
}
