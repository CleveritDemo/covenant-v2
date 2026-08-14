import React from 'react'
import { useT } from '@i18n/useT'
import type { LspInstalledServer, LspRuntimeMissing } from '@shared/lspTypes'
import { Button } from '../components/ui/Button'
import { SettingsField } from '../components/SettingsSection'
import { LspRuntimeHint } from './LspRuntimeHint'
import './CodeIntelServerRow.css'

interface CodeIntelServerRowProps {
  server: LspInstalledServer
  runtimeMissing: LspRuntimeMissing | null
  busy: boolean
  disabled: boolean
  percent: number | null
  error: string | null
  onInstall(): void
  onDelete(): void
  onRecheck(): void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Fila de un language server en Ajustes: instalar / borrar / re-comprobar
 * runtime, con el error de descarga y el aviso de runtime a la vista.
 */
export const CodeIntelServerRow: React.FC<CodeIntelServerRowProps> = ({
  server,
  runtimeMissing,
  busy,
  disabled,
  percent,
  error,
  onInstall,
  onDelete,
  onRecheck,
}) => {
  const { t } = useT()

  let label: string
  let onClick: (() => void) | undefined
  if (busy) {
    label = percent != null
      ? t('lsp.installingPercent', { percent })
      : t('lsp.installing')
  } else if (runtimeMissing && !server.installed) {
    label = t('lsp.recheck')
    onClick = onRecheck
  } else if (server.installed) {
    label = t('lsp.settings.delete')
    onClick = onDelete
  } else {
    label = t('lsp.settings.install')
    onClick = onInstall
  }

  return (
    <SettingsField
      compact
      label={`${server.name} ${server.version}`}
      hint={server.installed
        ? t('lsp.settings.installed', { size: formatBytes(server.sizeBytes) })
        : t('lsp.settings.notInstalled')}
      error={error ?? undefined}
    >
      <span className="code-intel-server-row__controls">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy}
          onClick={onClick}
        >
          {label}
        </Button>
        {runtimeMissing && !server.installed && (
          <LspRuntimeHint
            name={runtimeMissing.name}
            min={runtimeMissing.min}
            found={runtimeMissing.found}
            suggestion={runtimeMissing.suggestion}
          />
        )}
      </span>
    </SettingsField>
  )
}
