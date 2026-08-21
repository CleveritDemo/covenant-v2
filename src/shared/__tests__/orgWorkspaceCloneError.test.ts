import { describe, expect, it } from 'vitest'
import { diagnoseCloneError } from '../orgWorkspaceCloneError'

const CLEVERIT_SAML_STDERR = `Cloning into 'demo-repo'...
remote: The 'CleveritDemo' organization has enabled or enforced SAML SSO.
remote: Visit https://github.com/enterprises/cleveritpartnerdemo/sso?authorization_request=ADIZWKMRDKG4VXB4KUBQDTLKPIBKABCDEFGHIJKLMNOP to authorize your Personal Access Token for this organization.
remote: Please ask an admin to grant you authorization, or visit the URL above.
fatal: unable to access 'https://github.com/CleveritDemo/demo-repo.git/': The requested URL returned error: 403`

describe('diagnoseCloneError', () => {
  it('clasifica SAML SSO real (CleveritDemo) con orgName y ssoUrl', () => {
    const failure = diagnoseCloneError(CLEVERIT_SAML_STDERR, 'CleveritDemo/demo-repo')
    expect(failure.kind).toBe('saml-sso')
    expect(failure.orgName).toBe('CleveritDemo')
    expect(failure.ssoUrl).toBe(
      'https://github.com/enterprises/cleveritpartnerdemo/sso?authorization_request=ADIZWKMRDKG4VXB4KUBQDTLKPIBKABCDEFGHIJKLMNOP',
    )
    expect(failure.repoFullName).toBe('CleveritDemo/demo-repo')
    expect(failure.raw).toBe(CLEVERIT_SAML_STDERR.trim())
  })

  it('kind=saml-sso limpia puntuación final de ssoUrl', () => {
    const raw =
      "remote: Visit https://github.com/orgs/Acme/sso?authorization_request=ABC123. enabled or enforced SAML SSO."
    const failure = diagnoseCloneError(raw)
    expect(failure.kind).toBe('saml-sso')
    expect(failure.ssoUrl).toBe(
      'https://github.com/orgs/Acme/sso?authorization_request=ABC123',
    )
  })

  it('kind=unauthorized por 403 genérico o credenciales', () => {
    expect(diagnoseCloneError('fatal: Authentication failed for https://github.com/o/r').kind).toBe(
      'unauthorized',
    )
    expect(
      diagnoseCloneError("fatal: could not read Username for 'https://github.com': terminal prompts disabled")
        .kind,
    ).toBe('unauthorized')
    expect(diagnoseCloneError('remote: Bad credentials\nfatal: error: 403').kind).toBe(
      'unauthorized',
    )
    expect(
      diagnoseCloneError("fatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403")
        .kind,
    ).toBe('unauthorized')
  })

  it('kind=forbidden cuando 403 trae evidencia de permisos (no credenciales)', () => {
    const raw =
      "remote: Write access to repository not granted.\nfatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403"
    const failure = diagnoseCloneError(raw, 'o/r')
    expect(failure.kind).toBe('forbidden')
    expect(failure.repoFullName).toBe('o/r')
  })

  it('kind=not-found', () => {
    expect(diagnoseCloneError('remote: Repository not found.\nfatal: repository not found').kind).toBe(
      'not-found',
    )
    expect(diagnoseCloneError('The requested URL returned error: 404').kind).toBe('not-found')
    expect(diagnoseCloneError('ERROR: Repository not found.').kind).toBe('not-found')
  })

  it('kind=ssh-auth por Permission denied (publickey)', () => {
    const raw = `Cloning into '/tmp/x'...
git@github-credicorp: Permission denied (publickey).
fatal: Could not read from remote repository.`
    const failure = diagnoseCloneError(raw, 'org/repo')
    expect(failure.kind).toBe('ssh-auth')
    expect(failure.repoFullName).toBe('org/repo')
  })

  it('kind=ssh-auth por Could not read from remote repository', () => {
    const raw = `Cloning into '/tmp/x'...
fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.`
    expect(diagnoseCloneError(raw).kind).toBe('ssh-auth')
  })

  it('kind=ssh-auth por Host key verification failed', () => {
    const raw = `Cloning into '/tmp/x'...
Host key verification failed.
fatal: Could not read from remote repository.`
    expect(diagnoseCloneError(raw).kind).toBe('ssh-auth')
  })

  it('kind=forbidden no regresa ssh-auth cuando hay 403 con Permission denied', () => {
    const raw =
      "remote: Permission denied\nfatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403"
    expect(diagnoseCloneError(raw, 'o/r').kind).toBe('forbidden')
  })

  it('kind=network', () => {
    expect(diagnoseCloneError('fatal: Could not resolve host: github.com').kind).toBe('network')
    expect(diagnoseCloneError('Failed to connect: Connection refused').kind).toBe('network')
    expect(diagnoseCloneError('fatal: unable to access https://github.com/o/r.git: Failed to connect to github.com port 443: timed out').kind).toBe(
      'network',
    )
    expect(diagnoseCloneError('SSL certificate problem: unable to get local issuer certificate').kind).toBe(
      'network',
    )
    expect(
      diagnoseCloneError("fatal: unable to access 'https://github.com/o/r.git/': Could not connect")
        .kind,
    ).toBe('network')
  })

  it('kind=invalid-config para códigos propios', () => {
    expect(diagnoseCloneError('invalid-org-slug').kind).toBe('invalid-config')
    expect(diagnoseCloneError('invalid-workspace-slug').kind).toBe('invalid-config')
    expect(diagnoseCloneError('missing-default-dir').kind).toBe('invalid-config')
    expect(diagnoseCloneError('missing-token').kind).toBe('invalid-config')
    expect(diagnoseCloneError('invalid repo entry: (empty)').kind).toBe('invalid-config')
    expect(diagnoseCloneError('invalid repo name: bad/../x').kind).toBe('invalid-config')
  })

  it('kind=unknown para el resto; raw siempre trim', () => {
    const failure = diagnoseCloneError('  something weird happened  ')
    expect(failure.kind).toBe('unknown')
    expect(failure.raw).toBe('something weird happened')
  })

  it('token inyectado en stderr sale como *** en raw (tras redactar)', () => {
    const token = 'ghp_SECRETTOKEN_DO_NOT_LEAK'
    const stderr = `fatal: Authentication failed for 'https://x-access-token:${token}@github.com/o/r.git/'`
    const redacted = stderr.split(token).join('***')
    const failure = diagnoseCloneError(redacted, 'o/r')
    expect(failure.raw).toContain('***')
    expect(failure.raw).not.toContain(token)
    expect(failure.kind).toBe('unauthorized')
  })
})
