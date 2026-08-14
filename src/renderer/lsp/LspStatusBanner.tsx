import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import { FileEditorActionButton } from '../terminal/explorer/FileEditorActionButton'
import { grantConsentFor, lspManager, type LspDocStatus } from './manager'
import { LspRuntimeHint } from './LspRuntimeHint'

interface LspStatusBannerProps {
  status: LspDocStatus | null
  /** Lenguaje del archivo abierto; null si no tiene soporte. */
  language: string | null
  /** Reintentar el arranque LSP (el editor lo traduce a un retry token). */
  onRetry: () => void
}

/**
 * Banner de la cabecera del editor para los estados LSP que necesitan una acción
 * del usuario: pedir permiso de descarga, avisar que falta un runtime, o mostrar
 * un error. Los estados pasivos (`ready`, `starting`, `unsupported`, `disabled`)
 * no dibujan nada — de eso se encarga el chip.
 */
export const LspStatusBanner: React.FC<LspStatusBannerProps> = ({ status, language, onRetry }) => {
  const { t } = useT()
  const [percent, setPercent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!status || !language) return null
  if (status.kind === 'ready' || status.kind === 'starting') return null
  if (status.kind === 'unsupported' || status.kind === 'disabled') return null

  const handleDownload = async (): Promise<void> => {
    setBusy(true)
    setFailure(null)
    setPercent(null)
    grantConsentFor(language)
    try {
      await lspManager.download(language, setPercent)
      onRetry()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRecheck = async (): Promise<void> => {
    setBusy(true)
    setFailure(null)
    try {
      await window.api.lspRecheckRuntimes()
      onRetry()
    } finally {
      setBusy(false)
    }
  }

  if (busy) {
    return (
      <div className="lsp-banner" role="status">
        <span className="lsp-banner__progress">
          {percent == null
            ? t('lsp.installing')
            : t('lsp.installingPercent', { percent })}
        </span>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="lsp-banner" role="alert">
        <span>{t('lsp.error', { message: failure })}</span>
        <FileEditorActionButton label={t('lsp.retry')} onClick={() => { void handleDownload() }} />
      </div>
    )
  }

  if (status.kind === 'consent-needed') {
    return (
      <div className="lsp-banner" role="status">
        <span>{t('lsp.consent.hint', { name: status.name, size: status.approxSizeMb })}</span>
        <FileEditorActionButton
          label={t('lsp.consent.download')}
          onClick={() => { void handleDownload() }}
        />
      </div>
    )
  }

  if (status.kind === 'needs-runtime') {
    return (
      <div className="lsp-banner" role="status">
        <LspRuntimeHint
          name={status.name}
          min={status.min}
          found={status.found}
          suggestion={status.suggestion}
        />
        <FileEditorActionButton label={t('lsp.recheck')} onClick={() => { void handleRecheck() }} />
      </div>
    )
  }

  if (status.kind === 'downloading') {
    return (
      <div className="lsp-banner" role="status">
        <span className="lsp-banner__progress">
          {status.percent == null
            ? t('lsp.installing')
            : t('lsp.installingPercent', { percent: status.percent })}
        </span>
      </div>
    )
  }

  return (
    <div className="lsp-banner" role="alert">
      <span>{t('lsp.error', { message: status.message })}</span>
      <FileEditorActionButton label={t('lsp.retry')} onClick={onRetry} />
    </div>
  )
}
