import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  type CovenantAuthStatus,
  type CovenantOrg,
} from '../../covenantApi'
import { mapCovenantAuthError } from '../../covenantAuthErrorLabel'
import { SectionStatus } from '../OrgSectionStatus'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import './OnboardingStepAccount.css'

export interface OnboardingStepAccountProps {
  /** El pie del wizard necesita el estado de sesión para elegir la etiqueta de su botón. */
  onSignedInChange?: (signedIn: boolean) => void
  /** Hay orgs: cerrar el wizard y abrir el picker de workspaces org. */
  onLoadOrgWorkspace: () => void
}

const ORG_PREVIEW_LIMIT = 5
const GITHUB_TOKEN_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=repo,read:org&description=Covenant%20Gravity'

export const OnboardingStepAccount: React.FC<OnboardingStepAccountProps> = ({
  onSignedInChange,
  onLoadOrgWorkspace,
}) => {
  const { t } = useT()
  const [accountId, setAccountId] = useState('')
  const covenant = useMemo(() => getCovenantApi(accountId), [accountId])
  const [loading, setLoading] = useState(() => covenant != null)
  const [hasError, setHasError] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [auth, setAuth] = useState<CovenantAuthStatus | null>(null)
  const [orgs, setOrgs] = useState<CovenantOrg[]>([])
  const [signingIn, setSigningIn] = useState(false)
  const [tokenDraft, setTokenDraft] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [needsToken, setNeedsToken] = useState(false)
  const [tokenError, setTokenError] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!covenant) return

    async function loadStatus(): Promise<void> {
      setLoading(true)
      setHasError(false)
      const statusResult = await covenant!.status()
      if (cancelled) return

      if (!statusResult.ok) {
        setAuth(null)
        setOrgs([])
        setHasError(true)
        setLoading(false)
        return
      }

      setAuth(statusResult.data)

      if (!statusResult.data.signedIn) {
        setOrgs([])
        if (typeof window.api?.githubCheckToken === 'function') {
          const check = await window.api.githubCheckToken('')
          if (cancelled) return
          if (!check.ok) setNeedsToken(true)
        }
        setLoading(false)
        return
      }

      const orgsResult = await covenant!.orgsList()
      if (cancelled) return

      if (!orgsResult.ok) {
        setOrgs([])
        setHasError(true)
        setLoading(false)
        return
      }

      setOrgs(orgsResult.data)
      setLoading(false)
    }

    void loadStatus()

    return () => {
      cancelled = true
    }
  }, [covenant])

  async function handleSignIn(): Promise<void> {
    if (!covenant || signingIn) return

    setSigningIn(true)
    setHasError(false)
    setSignInError('')
    const result = await covenant.signIn()
    setSigningIn(false)

    if (!result.ok) {
      if (result.error === 'no-github-token') {
        setNeedsToken(true)
        return
      }
      setHasError(true)
      setSignInError(mapCovenantAuthError(result.error, t))
      return
    }

    setAuth(result.data)
    if (!result.data.signedIn) return

    setLoading(true)
    const orgsResult = await covenant.orgsList()
    setLoading(false)

    if (!orgsResult.ok) {
      setOrgs([])
      setHasError(true)
      return
    }

    setOrgs(orgsResult.data)
  }

  async function handleTokenSignIn(): Promise<void> {
    if (typeof window.api?.githubAccountUpsert !== 'function') return

    setSavingToken(true)
    setTokenError('')
    try {
      const listed =
        typeof window.api.githubAccountsList === 'function'
          ? await window.api.githubAccountsList()
          : { ok: false as const }
      const label = `Cuenta ${(listed.ok ? listed.accounts.length : 0) + 1}`
      const result = await window.api.githubAccountUpsert({
        label,
        token: tokenDraft.trim(),
      })
      if (!result.ok) {
        setTokenError(result.error)
        return
      }
      const newId = result.account?.id
      if (!newId) {
        setTokenError(t('onboarding.accountError'))
        return
      }
      const api = getCovenantApi(newId)
      if (!api) {
        setTokenError(t('onboarding.accountUnavailable'))
        return
      }
      const signed = await api.signIn()
      if (!signed.ok) {
        setTokenError(mapCovenantAuthError(signed.error, t))
        return
      }
      setTokenDraft('')
      setNeedsToken(false)
      setAccountId(newId)
    } finally {
      setSavingToken(false)
    }
  }

  const signedIn = auth?.signedIn === true
  const login = auth?.login?.trim() || ''
  const name = auth?.name?.trim() || ''
  const previewOrgs = orgs.slice(0, ORG_PREVIEW_LIMIT)
  const extraOrgCount = Math.max(0, orgs.length - ORG_PREVIEW_LIMIT)
  const errorLabel = signInError || (hasError ? t('onboarding.accountError') : null)

  useEffect(() => {
    onSignedInChange?.(covenant ? signedIn : false)
  }, [signedIn, covenant, onSignedInChange])

  if (!covenant) {
    return (
      <section className="onboarding__body" aria-labelledby="onboarding-account-title">
        <p className="onboarding-account__unavailable" role="status" id="onboarding-account-title">
          {t('onboarding.accountUnavailable')}
        </p>
      </section>
    )
  }

  return (
    <section className="onboarding__body onboarding-account" aria-labelledby="onboarding-account-title">
      <h3 className="onboarding__title" id="onboarding-account-title">
        {t('onboarding.accountTitle')}
      </h3>
      <p className="onboarding__lead">
        {t(signedIn ? 'onboarding.accountLeadSignedIn' : 'onboarding.accountLead')}
      </p>

      <SectionStatus
        loading={loading}
        error={errorLabel}
        loadingLabel={t('onboarding.accountLoading')}
      />

      {!loading && !signedIn ? (
        <div className="onboarding-account__actions">
          <Button variant="primary" size="sm" onClick={() => void handleSignIn()} disabled={signingIn}>
            {t('onboarding.accountSignIn')}
          </Button>
        </div>
      ) : null}

      {!loading && !signedIn && needsToken ? (
        <div className="onboarding-account__token">
          <p className="onboarding-account__token-hint">{t('onboarding.accountTokenHint')}</p>
          <Input
            id="onboarding-account-token"
            type="password"
            size="sm"
            value={tokenDraft}
            onChange={event => setTokenDraft(event.target.value)}
            placeholder={t('onboarding.accountTokenPlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="onboarding-account__token-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={savingToken || !tokenDraft.trim()}
              onClick={() => void handleTokenSignIn()}
            >
              {t('onboarding.accountTokenSubmit')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.api?.openExternalUrl(GITHUB_TOKEN_CREATE_URL)}
            >
              {t('onboarding.accountTokenCreate')}
            </Button>
          </div>
          {tokenError ? (
            <p className="onboarding-account__token-error" role="alert">
              {tokenError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && signedIn ? (
        <div className="onboarding-account__signed-in">
          {name || login ? (
            <>
              <p className="onboarding-account__label">{t('onboarding.accountSignedInAs')}</p>
              <p className="onboarding-account__user" role="status">
                {name && login && name !== login ? `${name} (@${login})` : name || login}
              </p>
            </>
          ) : null}

          {orgs.length > 0 ? (
            <>
              <p className="onboarding-account__label">{t('onboarding.accountOrgsLabel')}</p>
              <ul className="onboarding-account__orgs">
                {previewOrgs.map(org => (
                  <li key={org.slug} className="onboarding-account__org">
                    {org.name}
                  </li>
                ))}
              </ul>
              {extraOrgCount > 0 ? (
                <p className="onboarding-account__more">
                  {t('onboarding.accountMoreOrgs', { n: extraOrgCount })}
                </p>
              ) : null}
              <div className="onboarding-account__actions">
                <Button variant="primary" size="sm" onClick={onLoadOrgWorkspace}>
                  {t('onboarding.accountLoadWorkspace')}
                </Button>
              </div>
              <p className="onboarding-account__cta-hint">{t('onboarding.accountLoadWorkspaceHint')}</p>
            </>
          ) : hasError ? null : (
            <p className="onboarding-account__empty" role="status">
              {t('onboarding.accountNoOrgs')}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
