import React, { useCallback, useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { Button, Input } from './ui'
import { SettingsField } from './SettingsSection'
import './JiraConnectionField.css'

interface JiraStatus {
  configured: boolean
  site: string
  projectKeys: string[]
  connected: boolean
}

export interface JiraConnectionFieldProps {
  /** Proyecto activo: `jira.json` es suyo, no de la app. */
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
  const [connectedAs, setConnectedAs] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.api.jiraStatus(cwd).then((status: JiraStatus) => {
      if (cancelled || !status.configured) return
      setSite(status.site)
      setProjectKeys(status.projectKeys.join(', '))
    })
    return () => { cancelled = true }
  }, [cwd])

  const connect = useCallback(async () => {
    setBusy(true)
    setError('')
    const result = await window.api.jiraConnect(cwd, {
      site: site.trim(),
      email: email.trim(),
      apiToken,
      projectKeys: projectKeys.split(',').map(key => key.trim()).filter(Boolean),
    })
    setBusy(false)
    if (result.ok) {
      setConnectedAs(result.displayName ?? '')
      // El token ya está cifrado en disco; no hay razón para conservarlo en memoria.
      setApiToken('')
      return
    }
    setError(result.error ?? '')
  }, [cwd, site, email, apiToken, projectKeys])

  return (
    <div className="jira-connection">
      <SettingsField label={t('jira.siteLabel')} hint={t('jira.siteHint')} htmlFor="jira-site">
        <Input id="jira-site" value={site} onChange={event => setSite(event.target.value)} />
      </SettingsField>

      <SettingsField label={t('jira.emailLabel')} htmlFor="jira-email">
        <Input id="jira-email" value={email} onChange={event => setEmail(event.target.value)} />
      </SettingsField>

      <SettingsField label={t('jira.tokenLabel')} hint={t('jira.tokenHint')} htmlFor="jira-token">
        <Input
          id="jira-token"
          type="password"
          value={apiToken}
          onChange={event => setApiToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </SettingsField>

      <SettingsField label={t('jira.projectKeysLabel')} hint={t('jira.projectKeysHint')} htmlFor="jira-projects">
        <Input
          id="jira-projects"
          value={projectKeys}
          onChange={event => setProjectKeys(event.target.value)}
        />
      </SettingsField>

      <div className="jira-connection__actions">
        <Button onClick={() => void connect()} disabled={busy || !site.trim()}>
          {t('jira.connectAction')}
        </Button>
        {connectedAs
          ? <span className="jira-connection__ok">{t('jira.connectedAs', { name: connectedAs })}</span>
          : <span className="jira-connection__hint">{t('jira.disconnectedHint')}</span>}
      </div>
      {error ? <p className="jira-connection__error">{error}</p> : null}
    </div>
  )
}
