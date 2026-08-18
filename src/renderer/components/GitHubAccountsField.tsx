import React, { useCallback, useEffect, useState } from 'react'
import type { GitHubTokenCheck } from '@shared/githubActionsTypes'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import './GitHubAccountsField.css'

type GithubAccount = { id: string; label: string }

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; check: GitHubTokenCheck }

const NEW_CHECK_KEY = '__new__'

function hasGithubAccountsApi(): boolean {
  return typeof window.api?.githubAccountsList === 'function'
}

function GitHubAccountStatus({ state }: { state: CheckState }): React.ReactNode {
  const { t } = useT()
  const result = state.status === 'done' ? state.check : null
  const identity = result?.ok ? result : null
  const rejected = result && !result.ok && result.error !== 'missing' ? result.error : null

  return (
    <>
      {rejected ? (
        <span className="github-accounts__error" role="alert">
          {t('settings.githubTokenInvalid', { detail: rejected })}
        </span>
      ) : null}
      <span
        className="github-accounts__status"
        data-state={state.status === 'checking' ? 'checking' : identity ? 'ok' : 'idle'}
      >
        {state.status === 'checking' && t('settings.githubTokenChecking')}
        {identity && (
          <>
            {t('settings.githubTokenConnected', { login: identity.login })}
            {identity.scopes.length > 0 && (
              <span className="github-accounts__scopes">{identity.scopes.join(' · ')}</span>
            )}
          </>
        )}
        {result?.ok === false && result.error === 'missing' && t('settings.githubTokenMissing')}
      </span>
    </>
  )
}

export interface GitHubAccountsFieldProps {
  /** Workspaces abiertos cuyo binding apunta a la cuenta borrada. */
  onAccountDeleted?: (accountId: string) => void
}

/**
 * Lista de cuentas GitHub en Ajustes. El secreto vive en el llavero de main;
 * aquí sólo se edita etiqueta, default, alta y baja.
 */
export const GitHubAccountsField: React.FC<GitHubAccountsFieldProps> = ({
  onAccountDeleted,
}) => {
  const { t } = useT()
  const [accounts, setAccounts] = useState<GithubAccount[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [newLabel, setNewLabel] = useState('')
  const [newToken, setNewToken] = useState('')
  const [pendingDelete, setPendingDelete] = useState<GithubAccount | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (!hasGithubAccountsApi()) return
    const result = await window.api.githubAccountsList()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setAccounts(result.accounts)
    setDefaultAccountId(result.defaultAccountId)
    setLabels(Object.fromEntries(result.accounts.map(account => [account.id, account.label])))
  }, [])

  useEffect(() => { void load() }, [load])

  const runCheck = async (key: string, token: string): Promise<void> => {
    setChecks(prev => ({ ...prev, [key]: { status: 'checking' } }))
    if (typeof window.api?.githubCheckToken !== 'function') return
    const check = await window.api.githubCheckToken(token)
    setChecks(prev => ({ ...prev, [key]: { status: 'done', check } }))
  }

  const addAccount = async (): Promise<void> => {
    const label = newLabel.trim()
    const token = newToken.trim()
    if (!label || !hasGithubAccountsApi()) return
    setBusy(true)
    const result = await window.api.githubAccountUpsert({ label, token: token || undefined })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNewLabel('')
    setNewToken('')
    await load()
    if (token) {
      const id = result.account?.id
      if (id) void runCheck(id, token)
    }
  }

  const saveLabel = async (account: GithubAccount): Promise<void> => {
    const label = (labels[account.id] ?? account.label).trim()
    if (!label || label === account.label || !hasGithubAccountsApi()) return
    const result = await window.api.githubAccountUpsert({ id: account.id, label })
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
  }

  const setDefault = async (id: string): Promise<void> => {
    if (!hasGithubAccountsApi()) return
    const result = await window.api.githubAccountSetDefault(id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDefaultAccountId(id)
  }

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target || !hasGithubAccountsApi()) return
    const result = await window.api.githubAccountDelete(target.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onAccountDeleted?.(target.id)
    await load()
  }

  const empty = accounts.length === 0
  const hint = (
    <>
      {t('settings.githubTokenHint')}{' '}
      <button
        type="button"
        className="github-accounts__link"
        onClick={() => void window.api?.openExternalUrl('https://github.com/settings/tokens')}
      >
        github.com/settings/tokens
      </button>
    </>
  )

  return (
    <div className="github-accounts">
      <h4 className="github-accounts__title">{t('settings.githubAccountsTitle')}</h4>
      {empty ? <p className="github-accounts__empty">{hint}</p> : null}
      {error ? <p className="github-accounts__error" role="alert">{error}</p> : null}

      {accounts.length > 0 ? (
        <ul className="github-accounts__list">
          {accounts.map(account => {
            const isDefault = account.id === defaultAccountId
            return (
              <li key={account.id} className="github-accounts__row">
                <SettingsField
                  label={t('settings.githubAccountLabel')}
                  htmlFor={`github-account-label-${account.id}`}
                  compact
                >
                  <Input
                    id={`github-account-label-${account.id}`}
                    size="sm"
                    value={labels[account.id] ?? account.label}
                    onChange={event => setLabels(prev => ({ ...prev, [account.id]: event.target.value }))}
                    onBlur={() => void saveLabel(account)}
                    placeholder={t('settings.githubAccountLabelPlaceholder')}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </SettingsField>
                <div className="github-accounts__row-actions">
                  <Button
                    size="xs"
                    variant={isDefault ? 'primary' : 'ghost'}
                    pressed={isDefault}
                    disabled={isDefault || busy}
                    onClick={() => void setDefault(account.id)}
                  >
                    {t('settings.githubDefault')}
                  </Button>
                  <Button
                    size="xs"
                    disabled={busy}
                    aria-label={`${t('settings.githubValidate')} ${account.label}`}
                    onClick={() => void runCheck(account.id, '')}
                  >
                    {t('settings.githubValidate')}
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    disabled={busy}
                    aria-label={`${t('settings.githubDeleteAccount')} ${account.label}`}
                    onClick={() => setPendingDelete(account)}
                  >
                    {t('settings.githubDeleteAccount')}
                  </Button>
                </div>
                <GitHubAccountStatus state={checks[account.id] ?? { status: 'idle' }} />
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="github-accounts__add">
        <p className="github-accounts__add-title">{t('settings.githubAddAccount')}</p>
        <SettingsField
          label={t('settings.githubAccountLabel')}
          htmlFor="github-account-new-label"
          compact
        >
          <Input
            id="github-account-new-label"
            size="sm"
            value={newLabel}
            onChange={event => setNewLabel(event.target.value)}
            placeholder={t('settings.githubAccountLabelPlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
        </SettingsField>
        <SettingsField
          label={t('settings.githubTokenLabel')}
          htmlFor="github-account-new-token"
          compact
        >
          <Input
            id="github-account-new-token"
            type="password"
            size="sm"
            value={newToken}
            onChange={event => setNewToken(event.target.value)}
            placeholder={t('settings.githubTokenPlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
        </SettingsField>
        <div className="github-accounts__add-actions">
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !newLabel.trim()}
            onClick={() => void addAccount()}
          >
            {t('settings.githubAddAccount')}
          </Button>
          <Button
            size="sm"
            disabled={busy || !newToken.trim()}
            onClick={() => void runCheck(NEW_CHECK_KEY, newToken.trim())}
          >
            {t('settings.githubValidate')}
          </Button>
        </div>
        <GitHubAccountStatus state={checks[NEW_CHECK_KEY] ?? { status: 'idle' }} />
      </div>

      <ConfirmTerminalModal
        open={pendingDelete !== null}
        zIndex={760}
        message={t('settings.githubDeleteConfirm', { label: pendingDelete?.label ?? '' })}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
