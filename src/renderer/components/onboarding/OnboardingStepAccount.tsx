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
import './OnboardingStepAccount.css'

export interface OnboardingStepAccountProps {
  /** El pie del wizard necesita el estado de sesión para elegir la etiqueta de su botón. */
  onSignedInChange?: (signedIn: boolean) => void
  /** Hay orgs: cerrar el wizard y abrir el picker de workspaces org. */
  onLoadOrgWorkspace: () => void
}

const ORG_PREVIEW_LIMIT = 5

export const OnboardingStepAccount: React.FC<OnboardingStepAccountProps> = ({
  onSignedInChange,
  onLoadOrgWorkspace,
}) => {
  const { t } = useT()
  const covenant = useMemo(() => getCovenantApi(), [])
  const [loading, setLoading] = useState(() => covenant != null)
  const [hasError, setHasError] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [auth, setAuth] = useState<CovenantAuthStatus | null>(null)
  const [orgs, setOrgs] = useState<CovenantOrg[]>([])
  const [signingIn, setSigningIn] = useState(false)

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
