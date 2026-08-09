import React, { useCallback, useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import type { LspInstalledServer } from '@shared/lspTypes'
import { Button } from '../components/ui/Button'
import { SettingToggle } from '../components/ui/SettingToggle'
import { SettingsField } from '../components/SettingsSection'
import { codeIntelEnabled, grantConsentFor, lspManager, setCodeIntelEnabled } from './manager'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Gestión de los language servers: toggle maestro e inventario en disco. La
 * descarga por archivo abierto vive en el banner del editor; esto es para
 * pre-instalar o liberar espacio sin abrir un archivo del lenguaje.
 */
export const CodeIntelligenceSettings: React.FC = () => {
  const { t } = useT()
  const [enabled, setEnabled] = useState(codeIntelEnabled)
  const [servers, setServers] = useState<LspInstalledServer[]>([])
  const [busyLanguage, setBusyLanguage] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setServers(await window.api.lspListInstalled())
    } catch {
      // La IPC puede fallar; el resto de los ajustes tiene que seguir usable.
      setServers([])
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const handleInstall = async (language: string): Promise<void> => {
    setBusyLanguage(language)
    // Instalar desde ajustes ES el consentimiento: sin esto el editor volvería
    // a pedirlo con el server ya en disco.
    grantConsentFor(language)
    try {
      await lspManager.download(language, () => {})
    } finally {
      setBusyLanguage(null)
      await refresh()
    }
  }

  const handleDelete = async (language: string): Promise<void> => {
    setBusyLanguage(language)
    try {
      await window.api.lspDeleteServer(language)
    } finally {
      setBusyLanguage(null)
      await refresh()
    }
  }

  return (
    <>
      <SettingToggle
        checked={enabled}
        onChange={checked => {
          setEnabled(checked)
          setCodeIntelEnabled(checked)
        }}
        title={t('lsp.settings.masterToggle')}
        description={t('lsp.settings.hint')}
      />
      {servers.map(server => (
        <SettingsField
          key={server.language}
          compact
          label={`${server.name} ${server.version}`}
          hint={server.installed
            ? t('lsp.settings.installed', { size: formatBytes(server.sizeBytes) })
            : t('lsp.settings.notInstalled')}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={busyLanguage !== null}
            onClick={() => {
              void (server.installed ? handleDelete(server.language) : handleInstall(server.language))
            }}
          >
            {busyLanguage === server.language
              ? t('lsp.installing')
              : server.installed
                ? t('lsp.settings.delete')
                : t('lsp.settings.install')}
          </Button>
        </SettingsField>
      ))}
    </>
  )
}
