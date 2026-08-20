import React, { useState } from 'react'
import type { JiraAccount } from '@shared/jiraAccounts'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { SettingsField } from './SettingsSection'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Input } from './ui/Input'
import { OptionRow } from './ui/OptionRow'
import { Spinner } from './ui/Spinner'
import { Tooltip } from './ui/Tooltip'
import './JiraAccountsField.css'

export interface JiraAccountsFieldProps {
  accounts: JiraAccount[]
  defaultAccountId: string
  /** Cuenta atada a la carpeta abierta; '' = hereda la de por defecto. */
  workspaceAccountId: string
  /** false = no hay proyecto abierto: la fila de workspace no se monta. */
  hasProject: boolean
  busyAccountId?: string
  verifyResultById?: Record<string, { ok: boolean; message?: string }>
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
  onUseInWorkspace: (id: string) => void
  onVerify: (id: string) => void
  onAdd: (input: { label: string; site: string; email: string; apiToken: string }) => void
}

function monogramInitial(label: string): string {
  const trimmed = label.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

function jiraSiteHost(site: string): string {
  try {
    return new URL(site).host
  } catch {
    return site.replace(/^https:\/\//i, '')
  }
}

function JiraAccountStatusChip({
  verifyResult,
  busy,
}: {
  verifyResult?: { ok: boolean; message?: string }
  busy: boolean
}): React.ReactNode {
  const { t } = useT()

  if (busy) {
    return (
      <span className="jira-accounts-field__chip" data-state="checking">
        <Spinner aria-label={t('jiraAccounts.verifyChecking')} />
        {t('jiraAccounts.verifyChecking')}
      </span>
    )
  }

  if (!verifyResult) {
    return (
      <span className="jira-accounts-field__chip" data-state="idle">
        {t('jiraAccounts.notChecked')}
      </span>
    )
  }

  if (verifyResult.ok) {
    return (
      <span className="jira-accounts-field__chip" data-state="ok">
        {t('jiraAccounts.verifyOk')}
      </span>
    )
  }

  const detail = verifyResult.message?.trim()
  if (detail) {
    return (
      <div className="jira-accounts-field__status-block">
        <span className="jira-accounts-field__chip" data-state="error">
          {t('jiraAccounts.verifyFailed', { message: detail })}
        </span>
        <span className="jira-accounts-field__error-detail">{detail}</span>
      </div>
    )
  }

  return (
    <span className="jira-accounts-field__chip" data-state="error">
      {t('jiraAccounts.verifyFailedGeneric')}
    </span>
  )
}

type JiraAccountCardProps = {
  account: JiraAccount
  isDefault: boolean
  busy: boolean
  verifyResult?: { ok: boolean; message?: string }
  onSetDefault: () => void
  onVerify: () => void
  onDelete: () => void
}

function JiraAccountCard({
  account,
  isDefault,
  busy,
  verifyResult,
  onSetDefault,
  onVerify,
  onDelete,
}: JiraAccountCardProps): React.ReactNode {
  const { t } = useT()
  const host = jiraSiteHost(account.site)
  const secondaryText = `${host} · ${account.email}`

  return (
    <li className="jira-accounts-field__card">
      <div className="jira-accounts-field__card-main">
        <div className="jira-accounts-field__monogram" aria-hidden="true">
          {monogramInitial(account.label)}
        </div>
        <div className="jira-accounts-field__identity">
          <div className="jira-accounts-field__primary">{account.label}</div>
          <div className="jira-accounts-field__secondary">{secondaryText}</div>
        </div>
        <div className="jira-accounts-field__aside">
          <JiraAccountStatusChip verifyResult={verifyResult} busy={busy} />
          <div className="jira-accounts-field__actions">
            {isDefault ? (
              <Badge variant="accent">{t('jiraAccounts.defaultAccount')}</Badge>
            ) : (
              <Button size="xs" variant="ghost" disabled={busy} onClick={onSetDefault}>
                {t('jiraAccounts.makeDefault')}
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              aria-label={`${t('jiraAccounts.verify')} ${account.label}`}
              onClick={onVerify}
            >
              {t('jiraAccounts.verify')}
            </Button>
            <Tooltip content={t('jiraAccounts.deleteAccount')}>
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                aria-label={`${t('jiraAccounts.deleteAccount')} ${account.label}`}
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

export const JiraAccountsField: React.FC<JiraAccountsFieldProps> = ({
  accounts,
  defaultAccountId,
  workspaceAccountId,
  hasProject,
  busyAccountId,
  verifyResultById,
  onSetDefault,
  onDelete,
  onUseInWorkspace,
  onVerify,
  onAdd,
}) => {
  const { t } = useT()
  const [showAddForm, setShowAddForm] = useState(accounts.length === 0)
  const [newLabel, setNewLabel] = useState('')
  const [newSite, setNewSite] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newToken, setNewToken] = useState('')
  const [pendingDelete, setPendingDelete] = useState<JiraAccount | null>(null)

  const defaultAccount = accounts.find(account => account.id === defaultAccountId)
  const empty = accounts.length === 0
  const addReady =
    newLabel.trim().length > 0
    && newSite.trim().length > 0
    && newEmail.trim().length > 0
    && newToken.trim().length > 0

  const submitAdd = (): void => {
    if (!addReady) return
    onAdd({
      label: newLabel.trim(),
      site: newSite.trim(),
      email: newEmail.trim(),
      apiToken: newToken.trim(),
    })
    setNewLabel('')
    setNewSite('')
    setNewEmail('')
    setNewToken('')
    setShowAddForm(false)
  }

  const cancelAdd = (): void => {
    setNewLabel('')
    setNewSite('')
    setNewEmail('')
    setNewToken('')
    setShowAddForm(false)
  }

  return (
    <div className="jira-accounts-field">
      <h4 className="jira-accounts-field__title">{t('jiraAccounts.title')}</h4>
      {empty ? <p className="jira-accounts-field__hint">{t('jiraAccounts.hint')}</p> : null}

      {accounts.length > 0 ? (
        <ul className="jira-accounts-field__list">
          {accounts.map(account => (
            <JiraAccountCard
              key={account.id}
              account={account}
              isDefault={account.id === defaultAccountId}
              busy={busyAccountId === account.id}
              verifyResult={verifyResultById?.[account.id]}
              onSetDefault={() => onSetDefault(account.id)}
              onVerify={() => onVerify(account.id)}
              onDelete={() => setPendingDelete(account)}
            />
          ))}
        </ul>
      ) : null}

      {hasProject && accounts.length > 0 ? (
        <div className="jira-accounts-field__workspace">
          <h5 className="jira-accounts-field__workspace-title">{t('jiraAccounts.useInWorkspace')}</h5>
          <p className="jira-accounts-field__workspace-hint">{t('jiraAccounts.useInWorkspaceHint')}</p>
          <div className="jira-accounts-field__workspace-options">
            <OptionRow
              title={t('jiraAccounts.inheritDefault')}
              hint={
                defaultAccount
                  ? t('jiraAccounts.inheritDefaultHint', { label: defaultAccount.label })
                  : undefined
              }
              selected={workspaceAccountId === ''}
              onClick={() => onUseInWorkspace('')}
            />
            {accounts.map(account => (
              <OptionRow
                key={account.id}
                title={account.label}
                hint={jiraSiteHost(account.site)}
                selected={workspaceAccountId === account.id}
                onClick={() => onUseInWorkspace(account.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {accounts.length > 0 && !showAddForm ? (
        <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
          {t('jiraAccounts.addAccount')}
        </Button>
      ) : null}

      {showAddForm ? (
        <div
          className={[
            'jira-accounts-field__add',
            accounts.length > 0 ? 'jira-accounts-field__add--panel' : '',
          ].filter(Boolean).join(' ')}
        >
          {accounts.length > 0 ? null : (
            <p className="jira-accounts-field__add-title">{t('jiraAccounts.addAccount')}</p>
          )}
          <SettingsField
            label={t('jiraAccounts.labelField')}
            htmlFor="jira-account-new-label"
            compact
          >
            <Input
              id="jira-account-new-label"
              size="sm"
              value={newLabel}
              onChange={event => setNewLabel(event.target.value)}
              placeholder={t('jiraAccounts.labelPlaceholder')}
              spellCheck={false}
              autoComplete="off"
            />
          </SettingsField>
          <SettingsField
            label={t('jiraAccounts.siteField')}
            htmlFor="jira-account-new-site"
            compact
          >
            <Input
              id="jira-account-new-site"
              size="sm"
              value={newSite}
              onChange={event => setNewSite(event.target.value)}
              placeholder={t('jiraAccounts.sitePlaceholder')}
              spellCheck={false}
              autoComplete="off"
            />
          </SettingsField>
          <SettingsField
            label={t('jiraAccounts.emailField')}
            htmlFor="jira-account-new-email"
            compact
          >
            <Input
              id="jira-account-new-email"
              size="sm"
              value={newEmail}
              onChange={event => setNewEmail(event.target.value)}
              placeholder={t('jiraAccounts.emailPlaceholder')}
              spellCheck={false}
              autoComplete="email"
            />
          </SettingsField>
          <SettingsField
            label={t('jiraAccounts.tokenField')}
            htmlFor="jira-account-new-token"
            compact
          >
            <Input
              id="jira-account-new-token"
              type="password"
              size="sm"
              value={newToken}
              onChange={event => setNewToken(event.target.value)}
              placeholder={t('jiraAccounts.tokenPlaceholder')}
              spellCheck={false}
              autoComplete="off"
            />
          </SettingsField>
          <div className="jira-accounts-field__add-actions">
            <Button variant="primary" size="sm" disabled={!addReady} onClick={submitAdd}>
              {t('jiraAccounts.addAccount')}
            </Button>
            {accounts.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={cancelAdd}>
                {t('jiraAccounts.cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmTerminalModal
        open={pendingDelete !== null}
        zIndex={760}
        message={t('jiraAccounts.deleteConfirm', { label: pendingDelete?.label ?? '' })}
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (target) onDelete(target.id)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
