import React, { useCallback, useEffect, useState } from 'react'
import type { GitHubTokenCheck } from '@shared/githubActionsTypes'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { SettingsField } from './SettingsSection'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'
import { Tooltip } from './ui/Tooltip'
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

function avatarInitial(label: string, login?: string): string {
  const source = login ?? label
  return source.charAt(0).toUpperCase()
}

function GitHubAccountStatusChip({ state }: { state: CheckState }): React.ReactNode {
  const { t } = useT()
  const result = state.status === 'done' ? state.check : null
  const identity = result?.ok ? result : null
  const rejected = result && !result.ok && result.error !== 'missing' ? result.error : null

  if (state.status === 'idle') {
    return (
      <span className="github-accounts__chip" data-state="idle">
        {t('settings.githubNotChecked')}
      </span>
    )
  }

  if (state.status === 'checking') {
    return (
      <span className="github-accounts__chip" data-state="checking">
        <Spinner aria-label={t('settings.githubTokenChecking')} />
        {t('settings.githubTokenChecking')}
      </span>
    )
  }

  if (identity) {
    return (
      <span className="github-accounts__chip" data-state="ok">
        {t('settings.githubTokenConnected', { login: identity.login })}
      </span>
    )
  }

  if (result?.ok === false && result.error === 'missing') {
    return (
      <span className="github-accounts__chip" data-state="error">
        {t('settings.githubTokenMissing')}
      </span>
    )
  }

  if (rejected) {
    return (
      <div className="github-accounts__status-block">
        <span className="github-accounts__chip" data-state="error">
          {t('settings.githubTokenInvalid', { detail: rejected })}
        </span>
        <span className="github-accounts__error-detail">{rejected}</span>
      </div>
    )
  }
  return (
    <span className="github-accounts__chip" data-state="idle">
      {t('settings.githubNotChecked')}
    </span>
  )
}

type GitHubAccountCardProps = {
  account: GithubAccount
  isDefault: boolean
  busy: boolean
  check: CheckState
  label: string
  editing: boolean
  onLabelChange: (value: string) => void
  onSaveLabel: () => void
  onStartRename: () => void
  onSetDefault: () => void
  onVerify: () => void
  onDelete: () => void
}

function GitHubAccountCard({
  account,
  isDefault,
  busy,
  check,
  label,
  editing,
  onLabelChange,
  onSaveLabel,
  onStartRename,
  onSetDefault,
  onVerify,
  onDelete,
}: GitHubAccountCardProps): React.ReactNode {
  const { t } = useT()
  const result = check.status === 'done' && check.check.ok ? check.check : null
  const login = result?.login
  const verified = Boolean(login)
  const secondaryParts: string[] = []
  if (verified) secondaryParts.push(label)
  if (result && result.scopes.length > 0) secondaryParts.push(result.scopes.join(' · '))
  const secondaryText = secondaryParts.join(' · ')

  const labelInput = (
    <Input
      id={`github-account-label-${account.id}`}
      size="sm"
      value={label}
      onChange={event => onLabelChange(event.target.value)}
      onBlur={() => onSaveLabel()}
      placeholder={t('settings.githubAccountLabelPlaceholder')}
      spellCheck={false}
      autoComplete="off"
    />
  )

  return (
    <li className="github-accounts__card">
      <div className="github-accounts__card-main">
        <div className="github-accounts__avatar" aria-hidden="true">
          {avatarInitial(account.label, login)}
        </div>
        <div className="github-accounts__identity">
          {verified ? (
            <div className="github-accounts__primary">@{login}</div>
          ) : editing ? (
            labelInput
          ) : (
            <div className="github-accounts__primary">{label}</div>
          )}
          {verified ? (
            <div className="github-accounts__secondary">
              {editing ? labelInput : <span>{secondaryText}</span>}
            </div>
          ) : null}
        </div>
        <div className="github-accounts__aside">
          <GitHubAccountStatusChip state={check} />
          <div className="github-accounts__actions">
            {isDefault ? (
              <Badge variant="accent">{t('settings.githubDefault')}</Badge>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={onSetDefault}
              >
                {t('settings.githubMakeDefault')}
              </Button>
            )}
            {!editing ? (
              <Button size="xs" variant="ghost" disabled={busy} onClick={onStartRename}>
                {t('settings.githubRename')}
              </Button>
            ) : null}
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              aria-label={`${t('settings.githubValidate')} ${account.label}`}
              onClick={onVerify}
            >
              {t('settings.githubValidate')}
            </Button>
            <Tooltip content={t('settings.githubDeleteAccount')}>
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                aria-label={`${t('settings.githubDeleteAccount')} ${account.label}`}
                onClick={onDelete}
              >
                <Icon name="trash" size={13} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </li>
  )
}

function GitHubNewAccountStatus({ state }: { state: CheckState }): React.ReactNode {
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
  const [showAddForm, setShowAddForm] = useState(true)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)

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
    setShowAddForm(result.accounts.length === 0)
  }, [])

  useEffect(() => { void load() }, [load])

  const runAccountCheck = async (accountId: string): Promise<void> => {
    setChecks(prev => ({ ...prev, [accountId]: { status: 'checking' } }))
    if (typeof window.api?.githubAccountCheck !== 'function') return
    const check = await window.api.githubAccountCheck(accountId)
    setChecks(prev => ({ ...prev, [accountId]: { status: 'done', check } }))
  }

  const runNewTokenCheck = async (token: string): Promise<void> => {
    setChecks(prev => ({ ...prev, [NEW_CHECK_KEY]: { status: 'checking' } }))
    if (typeof window.api?.githubCheckToken !== 'function') return
    const check = await window.api.githubCheckToken(token)
    setChecks(prev => ({ ...prev, [NEW_CHECK_KEY]: { status: 'done', check } }))
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
    setShowAddForm(false)
    await load()
    const id = result.account?.id
    if (id && token) void runAccountCheck(id)
  }

  const cancelAdd = (): void => {
    setNewLabel('')
    setNewToken('')
    setShowAddForm(false)
    setChecks(prev => {
      const next = { ...prev }
      delete next[NEW_CHECK_KEY]
      return next
    })
  }

  const saveLabel = async (account: GithubAccount): Promise<void> => {
    const label = (labels[account.id] ?? account.label).trim()
    setEditingLabelId(null)
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
          {accounts.map(account => (
            <GitHubAccountCard
              key={account.id}
              account={account}
              isDefault={account.id === defaultAccountId}
              busy={busy}
              check={checks[account.id] ?? { status: 'idle' }}
              label={labels[account.id] ?? account.label}
              editing={editingLabelId === account.id}
              onLabelChange={value => setLabels(prev => ({ ...prev, [account.id]: value }))}
              onSaveLabel={() => void saveLabel(account)}
              onStartRename={() => setEditingLabelId(account.id)}
              onSetDefault={() => void setDefault(account.id)}
              onVerify={() => void runAccountCheck(account.id)}
              onDelete={() => setPendingDelete(account)}
            />
          ))}
        </ul>
      ) : null}

      {accounts.length > 0 && !showAddForm ? (
        <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
          {t('settings.githubAddAccount')}
        </Button>
      ) : null}

      {showAddForm ? (
        <div
          className={[
            'github-accounts__add',
            accounts.length > 0 ? 'github-accounts__add--panel' : '',
          ].filter(Boolean).join(' ')}
        >
          {accounts.length > 0 ? null : <p className="github-accounts__add-title">{t('settings.githubAddAccount')}</p>}
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
            {accounts.length > 0 ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={cancelAdd}>
                {t('settings.githubCancel')}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={busy || !newToken.trim()}
              onClick={() => void runNewTokenCheck(newToken.trim())}
            >
              {t('settings.githubValidate')}
            </Button>
          </div>
          <GitHubNewAccountStatus state={checks[NEW_CHECK_KEY] ?? { status: 'idle' }} />
        </div>
      ) : null}

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
