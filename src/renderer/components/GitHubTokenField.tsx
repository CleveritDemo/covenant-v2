import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubTokenCheck } from '@shared/githubActionsTypes'
import { useT } from '@i18n/useT'
import { SettingsField } from './SettingsSection'
import { Input } from './ui/Input'
import './GitHubTokenField.css'

type CheckState = { status: 'idle' } | { status: 'checking' } | { status: 'done'; check: GitHubTokenCheck }

interface Props {
  value: string
  onChange: (value: string) => void
}

/**
 * Token de GitHub con identidad en vez de sólo secreto: al abrir Ajustes y al
 * salir del campo se pregunta a la API de quién es y qué scopes tiene.
 */
export const GitHubTokenField: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useT()
  const [state, setState] = useState<CheckState>({ status: 'idle' })
  /** Último valor comprobado: evita repetir la llamada al salir del campo sin tocarlo. */
  const checkedRef = useRef<string | null>(null)
  const seq = useRef(0)

  const check = useCallback(async (token: string): Promise<void> => {
    const ticket = seq.current + 1
    seq.current = ticket
    checkedRef.current = token
    setState({ status: 'checking' })

    const result = await window.api.githubCheckToken(token)
    if (seq.current !== ticket) return // llegó tarde: ya hay otra en curso
    setState({ status: 'done', check: result })
  }, [])

  // Al montar se comprueba el token efectivo, aunque venga del entorno.
  useEffect(() => { void check(value.trim()) }, [check]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlur = (): void => {
    const token = value.trim()
    if (token === checkedRef.current) return
    void check(token)
  }

  const result = state.status === 'done' ? state.check : null
  const identity = result?.ok ? result : null
  // «missing» no es un rechazo: el token puede venir del entorno o del credential helper.
  const rejected = result && !result.ok && result.error !== 'missing' ? result.error : null

  return (
    <SettingsField
      label={t('settings.githubTokenLabel')}
      error={rejected ? t('settings.githubTokenInvalid', { detail: rejected }) : undefined}
      hint={
        <>
          {t('settings.githubTokenHint')}{' '}
          <button
            type="button"
            className="settings-inline-link"
            onClick={() => void window.api.openExternalUrl('https://github.com/settings/tokens')}
          >
            github.com/settings/tokens
          </button>
        </>
      }
    >
      <Input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={t('settings.githubTokenPlaceholder')}
        aria-invalid={rejected ? true : undefined}
        spellCheck={false}
        autoComplete="off"
      />
      <span
        className="github-token-status"
        data-state={state.status === 'checking' ? 'checking' : identity ? 'ok' : 'idle'}
      >
        {state.status === 'checking' && t('settings.githubTokenChecking')}
        {identity && (
          <>
            {t('settings.githubTokenConnected', { login: identity.login })}
            {identity.scopes.length > 0 && (
              <span className="github-token-status__scopes">{identity.scopes.join(' · ')}</span>
            )}
          </>
        )}
        {result?.ok === false && result.error === 'missing' && t('settings.githubTokenMissing')}
      </span>
    </SettingsField>
  )
}
