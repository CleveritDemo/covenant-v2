import React, { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/updateState'
import { changelogSection } from '@shared/changelog'
import { useT } from '@i18n/useT'
import { AiMarkdown } from './AiMarkdown'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'
import {
  clearUpdateBannerPreview,
  getUpdateBannerPreviewState,
  isUpdateBannerPreviewActive,
  subscribeUpdateBannerPreview,
} from '../updateBannerPreview'
// El CHANGELOG viaja dentro del bundle: tras actualizar es la única fuente local.
import changelogMd from '../../../CHANGELOG.md?raw'
import './UpdateBanner.css'

const LAST_SEEN_KEY = 'gravity.update.lastSeenVersion'
const releaseUrl = (version: string): string =>
  `https://github.com/CleveritDemo/covenant-v2/releases/tag/v${version}`

/** Lo que se está enseñando en el modal: actualización pendiente o versión recién instalada. */
type NotesView = { version: string; notes: string | null; installed: boolean }

/**
 * Chip compacto en la titlebar: punto + versión + badge de etapa + acción (o barra).
 * El estado vive en main (electron/selfUpdate.ts); el preview de Developer puede
 * sobreescribirlo solo en renderer.
 *
 * Además abre «Novedades» sola en el primer arranque tras subir de versión,
 * con la sección del CHANGELOG empaquetado.
 */
export const UpdateBanner: React.FC = () => {
  const { t } = useT()
  const [ipcState, setIpcState] = useState<UpdateState>({ kind: 'idle' })
  const [previewState, setPreviewState] = useState<UpdateState | null>(
    () => getUpdateBannerPreviewState(),
  )
  const [view, setView] = useState<NotesView | null>(null)

  useEffect(() => {
    void window.api.getUpdateState().then(setIpcState)
    return window.api.onUpdateState(setIpcState)
  }, [])

  useEffect(() => {
    return subscribeUpdateBannerPreview(() => {
      setPreviewState(getUpdateBannerPreviewState())
    })
  }, [])

  useEffect(() => {
    void window.api.getAppVersion().then(version => {
      let seen: string | null = null
      try {
        seen = localStorage.getItem(LAST_SEEN_KEY)
        localStorage.setItem(LAST_SEEN_KEY, version)
      } catch { /* modo privado: sin marca, sin auto-apertura */ }
      // Sin marca previa es una instalación limpia: no se enseña changelog de bienvenida.
      if (seen && seen !== version) {
        setView({ version, notes: changelogSection(changelogMd, version), installed: true })
      }
    })
  }, [])

  const state = previewState ?? ipcState
  const previewing = isUpdateBannerPreviewActive()
  const canInstall = state.kind === 'available' || state.kind === 'ready'
  const install = (): void => {
    if (previewing) {
      clearUpdateBannerPreview()
      return
    }
    setView(null)
    window.api.installUpdate()
  }
  const dismiss = (): void => {
    if (previewing) {
      clearUpdateBannerPreview()
      return
    }
    window.api.dismissUpdate()
  }
  const openPending = (): void => {
    if (previewing) return
    if (state.kind !== 'available' && state.kind !== 'ready') return
    setView({ version: state.version, notes: state.notes, installed: false })
  }

  const percent = state.kind === 'downloading'
    ? Math.max(0, Math.min(100, Math.round(state.percent)))
    : 0

  const stageLabel =
    state.kind === 'available'
      ? t('update.stageAvailable')
      : state.kind === 'downloading'
        ? t('update.stageDownloading')
        : state.kind === 'ready'
          ? t('update.stageReady')
          : null

  const chipAria =
    state.kind === 'downloading'
      ? t('update.downloadingAria', { version: state.version, percent })
      : state.kind === 'error'
        ? t('update.error', { message: state.message })
        : state.kind === 'ready'
          ? t('update.readyAria', { version: state.version })
          : state.kind === 'available'
            ? t('update.availableAria', { version: state.version })
            : undefined

  return (
    <>
      {state.kind !== 'idle' && (
        <div
          className={[
            'update-banner',
            'update-banner--enter',
            state.kind === 'downloading' ? 'update-banner--downloading' : '',
            state.kind === 'error' ? 'update-banner--error' : '',
          ].filter(Boolean).join(' ')}
          role="status"
          aria-label={chipAria}
        >
          {state.kind === 'error' ? (
            <span className="update-banner__pulse update-banner__pulse--error" aria-hidden="true" />
          ) : (
            <span className="update-banner__pulse" aria-hidden="true" />
          )}

          {state.kind === 'error' ? (
            <Tooltip content={state.message}>
              <span className="update-banner__error">
                {state.message}
              </span>
            </Tooltip>
          ) : (
            <button
              type="button"
              className="update-banner__version"
              aria-label={t('update.notesTitle')}
              onClick={openPending}
              disabled={state.kind === 'downloading' || previewing}
            >
              v{state.version}
            </button>
          )}

          {stageLabel && (
            <span className="update-banner__stage">{stageLabel}</span>
          )}

          {state.kind === 'downloading' && (
            <div
              className="update-banner__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t('update.downloadingAria', { version: state.version, percent })}
            >
              <div
                className="update-banner__fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          {canInstall && (
            <Button variant="primary" size="xs" onClick={install}>
              {state.kind === 'ready' ? t('update.restart') : t('update.install')}
            </Button>
          )}

          {state.kind !== 'downloading' && (
            <Button
              variant="icon"
              tabIndex={-1}
              onClick={dismiss}
              aria-label={t('update.dismiss')}
            >
              <Icon name="close" size={13} />
            </Button>
          )}
        </div>
      )}

      <TerminalModal
        open={view !== null}
        onClose={() => setView(null)}
        size="md"
        closeOnEscape
        closeOnBackdrop
        headerContent={
          <div className="update-notes__head">
            <span className="update-notes__ver">v{view?.version}</span>
            <div>
              <div className="update-notes__title">{t('update.whatsNewTitle')}</div>
              <div className="update-notes__sub">
                {view?.installed ? t('update.installedSub') : t('update.availableSub')}
              </div>
            </div>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setView(null)}>
              {view?.installed ? t('update.gotIt') : t('update.later')}
            </Button>
            {!view?.installed && canInstall && (
              <Button variant="primary" size="sm" onClick={install}>
                {state.kind === 'ready' ? t('update.restart') : t('update.install')}
              </Button>
            )}
          </>
        }
      >
        {view?.notes
          ? <AiMarkdown content={view.notes} />
          : (
            <div className="update-notes__empty">
              <p>{t('update.noNotes')}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => view && void window.api.openExternalUrl(releaseUrl(view.version))}
              >
                {t('update.viewOnGitHub')}
              </Button>
            </div>
          )}
      </TerminalModal>
    </>
  )
}
