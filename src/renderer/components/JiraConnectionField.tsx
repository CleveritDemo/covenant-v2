import React, { useCallback, useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { Button, Input } from './ui'
import { SettingsField } from './SettingsSection'
import './JiraConnectionField.css'

interface JiraStatus {
  configured: boolean
  site: string
  email: string
  projectKeys: string[]
  connected: boolean
}

export interface JiraConnectionFieldProps {
  /** Proyecto activo: `jira.json` es suyo, no de la app. Vacío = pestaña sin proyecto. */
  cwd: string
}

/**
 * Conexión a Jira Cloud. El token se manda a `jiraConnect`, que lo prueba contra
 * `/myself` antes de cifrarlo; nunca pasa por `config.json` ni por el form de Ajustes.
 */
export const JiraConnectionField: React.FC<JiraConnectionFieldProps> = ({ cwd }) => {
  const { t } = useT()
  const [site, setSite] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [projectKeys, setProjectKeys] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connectedAs, setConnectedAs] = useState('')
  /**
   * Que YA haya credenciales válidas guardadas, sea o no de esta sesión de
   * Ajustes. Sin esto, reabrir Ajustes con una conexión que funciona pintaba
   * «Sin conectar» y empujaba al usuario a reconectar con el email vacío que
   * el formulario tampoco repoblaba: 401 encima de algo que iba bien.
   */
  const [connected, setConnected] = useState(false)
  const hasProject = Boolean(cwd.trim())

  useEffect(() => {
    if (!hasProject) {
      setConnected(false)
      setConnectedAs('')
      return
    }
    let cancelled = false
    void window.api.jiraStatus(cwd).then((status: JiraStatus) => {
      if (cancelled || !status.configured) return
      setSite(status.site)
      setProjectKeys(status.projectKeys.join(', '))
      // El email no es secreto (el secreto es el token) y sin él el formulario
      // no se puede reenviar: `jiraStatus` lo devuelve junto al sitio.
      setEmail(status.email)
      setConnected(status.connected)
    })
    return () => { cancelled = true }
  }, [cwd, hasProject])

  const connect = useCallback(async () => {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await window.api.jiraConnect(cwd, {
      site: site.trim(),
      email: email.trim(),
      apiToken,
      projectKeys: projectKeys.split(',').map(key => key.trim()).filter(Boolean),
    })
    setBusy(false)
    if (result.ok) {
      setConnectedAs(result.displayName ?? '')
      setConnected(true)
      // El token ya está cifrado en disco; no hay razón para conservarlo en memoria.
      setApiToken('')
      if (result.gitignore === 'appended') setNotice(t('jira.gitignoreAppended'))
      return
    }
    setError(result.error ?? '')
  }, [cwd, site, email, apiToken, projectKeys, t])

  const disconnect = useCallback(async () => {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await window.api.jiraDisconnect(cwd)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? '')
      return
    }
    setConnected(false)
    setConnectedAs('')
    setApiToken('')
  }, [cwd])

  return (
    <div className="jira-connection">
      <SettingsField
        label={t('jira.siteLabel')}
        hint={hasProject ? t('jira.siteHint') : t('jira.noProjectHint')}
        htmlFor="jira-site"
      >
        <Input
          id="jira-site"
          value={site}
          disabled={!hasProject}
          onChange={event => setSite(event.target.value)}
        />
      </SettingsField>

      <SettingsField label={t('jira.emailLabel')} htmlFor="jira-email">
        <Input
          id="jira-email"
          value={email}
          disabled={!hasProject}
          onChange={event => setEmail(event.target.value)}
        />
      </SettingsField>

      <SettingsField label={t('jira.tokenLabel')} hint={t('jira.tokenHint')} htmlFor="jira-token">
        <Input
          id="jira-token"
          type="password"
          value={apiToken}
          disabled={!hasProject}
          onChange={event => setApiToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </SettingsField>

      <SettingsField label={t('jira.projectKeysLabel')} hint={t('jira.projectKeysHint')} htmlFor="jira-projects">
        <Input
          id="jira-projects"
          value={projectKeys}
          disabled={!hasProject}
          onChange={event => setProjectKeys(event.target.value)}
        />
      </SettingsField>

      <div className="jira-connection__actions">
        <Button onClick={() => void connect()} disabled={busy || !hasProject || !site.trim()}>
          {connected ? t('jira.reconnectAction') : t('jira.connectAction')}
        </Button>
        {connected ? (
          <Button onClick={() => void disconnect()} disabled={busy} variant="danger">
            {t('jira.disconnectAction')}
          </Button>
        ) : null}
        {connected
          ? (
            <span className="jira-connection__ok">
              {connectedAs
                ? t('jira.connectedAs', { name: connectedAs })
                : t('jira.connectedToSite', { site })}
            </span>
          )
          : (
            <span className="jira-connection__hint">
              {hasProject ? t('jira.disconnectedHint') : t('jira.noProjectHint')}
            </span>
          )}
      </div>
      {notice ? <p className="jira-connection__notice">{notice}</p> : null}
      {error ? <p className="jira-connection__error">{error}</p> : null}
    </div>
  )
}
