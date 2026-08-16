import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  type CovenantAuthStatus,
  type CovenantOrg,
} from '../../covenantApi'
import { SectionStatus } from '../OrgSectionStatus'
import { Button } from '../ui/Button'
import './OnboardingStepAccount.css'

export interface OnboardingStepAccountProps {
  /** Seguir sin cuenta: el wizard continúa igual. */
  onSkipAccount: () => void
  /** Hay orgs: cerrar el wizard y abrir el picker de workspaces org. */
  onLoadOrgWorkspace: () => void
}

const ORG_PREVIEW_LIMIT = 5

export const OnboardingStepAccount: React.FC<OnboardingStepAccountProps> = ({
  onSkipAccount,
  onLoadOrgWorkspace,
}) => {
  const { t } = useT()
  const covenant = useMemo(() => getCovenantApi(), [])
  const [loading, setLoading] = useState(() => covenant != null)
  const [hasError, setHasError] = useState(false)
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
    const result = await covenant.signIn()
    setSigningIn(false)

    if (!result.ok) {
      setHasError(true)
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
  const errorLabel = hasError ? t('onboarding.accountError') : null

  const skipButton = (
    <Button variant="ghost" size="sm" onClick={onSkipAccount}>
      {t(signedIn ? 'onboarding.accountContinue' : 'onboarding.accountSkip')}
    </Button>
  )

  if (!covenant) {
    return (
      <section className="onboarding__body" aria-labelledby="onboarding-account-title">
        <p className="onboarding-account__unavailable" role="status" id="onboarding-account-title">
          {t('onboarding.accountUnavailable')}
        </p>
        <div className="onboarding__actions onboarding-account__actions">{skipButton}</div>
      </section>
    )
  }

  return (
    <section className="onboarding__body onboarding-account" aria-labelledby="onboarding-account-title">
      <h3 className="onboarding__title" id="onboarding-account-title">
        {t('onboarding.accountTitle')}
      </h3>
      <p className="onboarding__lead">{t('onboarding.accountLead')}</p>

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
            <p className="onboarding-account__user" role="status">
              {name && login && name !== login ? `${name} (@${login})` : name || login}
            </p>
          ) : null}

          {orgs.length > 0 ? (
            <>
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
            </>
          ) : hasError ? null : (
            <p className="onboarding-account__empty" role="status">
              {t('onboarding.accountNoOrgs')}
            </p>
          )}
        </div>
      ) : null}

      <div className="onboarding__actions onboarding-account__actions">{skipButton}</div>
    </section>
  )
}
