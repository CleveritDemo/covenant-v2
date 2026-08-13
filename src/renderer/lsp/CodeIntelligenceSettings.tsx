import React, { useCallback, useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import type { LspInstalledServer, LspRuntimeMissing } from '@shared/lspTypes'
import { SettingToggle } from '../components/ui/SettingToggle'
import { CodeIntelServerRow } from './CodeIntelServerRow'
import { codeIntelEnabled, grantConsentFor, lspManager, setCodeIntelEnabled } from './manager'

/**
 * Gestión de los language servers: toggle maestro e inventario en disco. La
 * descarga por archivo abierto vive en el banner del editor; esto es para
 * pre-instalar o liberar espacio sin abrir un archivo del lenguaje.
 */
export const CodeIntelligenceSettings: React.FC = () => {
  const { t } = useT()
  const [enabled, setEnabled] = useState(codeIntelEnabled)
  const [servers, setServers] = useState<LspInstalledServer[]>([])
  const [runtimeMissing, setRuntimeMissing] = useState<Record<string, LspRuntimeMissing | null>>({})
  const [busyLanguage, setBusyLanguage] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.lspListInstalled()
      setServers(list)
      const statuses = await Promise.all(list.map(s => window.api.lspServerStatus(s.language)))
      const missing: Record<string, LspRuntimeMissing | null> = {}
      list.forEach((s, i) => {
        const st = statuses[i]
        missing[s.language] = st && 'error' in st ? null : (st?.runtimeMissing ?? null)
      })
      setRuntimeMissing(missing)
    } catch {
      // La IPC puede fallar; el resto de los ajustes tiene que seguir usable.
      setServers([])
      setRuntimeMissing({})
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const clearError = (language: string): void => {
    setErrors(prev => {
      if (!(language in prev)) return prev
      const next = { ...prev }
      delete next[language]
      return next
    })
  }

  const handleInstall = async (language: string): Promise<void> => {
    if (busyLanguage) return
    clearError(language)
    setPercent(null)
    setBusyLanguage(language)
    // Instalar desde ajustes ES el consentimiento: sin esto el editor volvería
    // a pedirlo con el server ya en disco.
    grantConsentFor(language)
    try {
      await lspManager.download(language, setPercent)
    } catch (e) {
      setErrors(prev => ({
        ...prev,
        [language]: t('lsp.settings.installError', {
          message: e instanceof Error ? e.message : String(e),
        }),
      }))
    } finally {
      setBusyLanguage(null)
      setPercent(null)
      await refresh()
    }
  }

  const handleDelete = async (language: string): Promise<void> => {
    setBusyLanguage(language)
    try {
      const result = await window.api.lspDeleteServer(language)
      if (result.ok === false) {
        setErrors(prev => ({
          ...prev,
          [language]: t('lsp.settings.deleteError', { message: result.error ?? '' }),
        }))
      }
    } finally {
      setBusyLanguage(null)
      await refresh()
    }
  }

  const handleRecheck = async (language: string): Promise<void> => {
    await window.api.lspRecheckRuntimes()
    clearError(language)
    await refresh()
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
        <CodeIntelServerRow
          key={server.language}
          server={server}
          runtimeMissing={runtimeMissing[server.language] ?? null}
          busy={busyLanguage === server.language}
          disabled={busyLanguage !== null}
          percent={busyLanguage === server.language ? percent : null}
          error={errors[server.language] ?? null}
          onInstall={() => { void handleInstall(server.language) }}
          onDelete={() => { void handleDelete(server.language) }}
          onRecheck={() => { void handleRecheck(server.language) }}
        />
      ))}
    </>
  )
}
