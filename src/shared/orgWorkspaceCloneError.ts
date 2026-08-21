/** Diagnóstico del stderr de `git clone` para workspaces org. */
export type OrgWorkspaceCloneErrorKind =
  | 'saml-sso'
  | 'forbidden'
  | 'unauthorized'
  | 'not-found'
  | 'ssh-auth'
  | 'network'
  | 'invalid-config'
  | 'unknown'

export type OrgWorkspaceCloneFailure = {
  kind: OrgWorkspaceCloneErrorKind
  /** owner/repo que falló, si se conoce. */
  repoFullName?: string
  /** Org de GitHub mencionada por el remote (p. ej. 'CleveritDemo'). */
  orgName?: string
  /** URL de autorización SSO extraída del stderr, si viene. */
  ssoUrl?: string
  /** stderr crudo ya redactado (sin token), para "detalles técnicos". */
  raw: string
}

export function diagnoseCloneError(
  rawError: string,
  repoFullName?: string,
): OrgWorkspaceCloneFailure {
  const raw = rawError.trim()
  const withRepo = {
    raw,
    ...(repoFullName !== undefined && repoFullName !== '' ? { repoFullName } : {}),
  }

  const invalidConfigMarkers = [
    'invalid-org-slug',
    'invalid-workspace-slug',
    'missing-default-dir',
    'missing-token',
    'invalid repo entry:',
    'invalid repo name:',
  ] as const
  if (invalidConfigMarkers.some(m => raw === m || raw.startsWith(m))) {
    return { kind: 'invalid-config', ...withRepo }
  }

  if (/SAML SSO/i.test(raw) || /enabled or enforced SAML/i.test(raw)) {
    const ssoMatch = raw.match(
      /https:\/\/github\.com\/(?:enterprises|orgs)\/[^/\s]+\/sso\?authorization_request=[^\s]+/i,
    )
    const orgMatch = raw.match(/The '([^']+)' organization/)
    return {
      kind: 'saml-sso',
      ...withRepo,
      ...(orgMatch ? { orgName: orgMatch[1] } : {}),
      ...(ssoMatch ? { ssoUrl: ssoMatch[0].replace(/[.,']+$/, '') } : {}),
    }
  }

  if (/Repository not found/i.test(raw) || /(?:error:\s*|returned error:\s*)404\b/i.test(raw)) {
    return { kind: 'not-found', ...withRepo }
  }

  if (
    /Permission denied \(publickey\)/i.test(raw) ||
    /Could not read from remote repository/i.test(raw) ||
    /Host key verification failed/i.test(raw)
  ) {
    return { kind: 'ssh-auth', ...withRepo }
  }

  const hasCredentials =
    /Authentication failed|could not read Username|Bad credentials|Invalid username or password/i.test(
      raw,
    )
  const has403 = /(?:error:\s*|returned error:\s*)403\b/i.test(raw)
  const has401 = /(?:error:\s*|returned error:\s*)401\b/i.test(raw)

  // forbidden: 403 + ACL/permission language, without credential-failure phrases.
  // Bare `error: 403` without that evidence stays unauthorized.
  if (
    has403 &&
    /Permission denied|does not have (?:permission|access)|Write access|not authorized to|Resource not accessible by integration/i.test(
      raw,
    ) &&
    !hasCredentials &&
    !has401
  ) {
    return { kind: 'forbidden', ...withRepo }
  }

  if (hasCredentials || has401 || has403) {
    return { kind: 'unauthorized', ...withRepo }
  }

  if (
    /Could not resolve host/i.test(raw) ||
    /Connection refused/i.test(raw) ||
    /timed out/i.test(raw) ||
    /\bSSL\b/i.test(raw) ||
    (/unable to access/i.test(raw) && !/(?:error:\s*|returned error:\s*)\d{3}\b/i.test(raw))
  ) {
    return { kind: 'network', ...withRepo }
  }

  return { kind: 'unknown', ...withRepo }
}
