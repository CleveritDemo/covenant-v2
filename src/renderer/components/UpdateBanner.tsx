import React, { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/updateState'
import { changelogSection } from '@shared/changelog'
import { useT } from '@i18n/useT'
import { AiMarkdown } from './AiMarkdown'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
// El CHANGELOG viaja dentro del bundle: tras actualizar es la única fuente local.
import changelogMd from '../../../CHANGELOG.md?raw'
import './UpdateBanner.css'

const LAST_SEEN_KEY = 'gravity.update.lastSeenVersion'
const releaseUrl = (version: string): string =>
  `https://github.com/CleveritDemo/covenant-v2/releases/tag/v${version}`

/** Lo que se está enseñando en el modal: actualización pendiente o versión recién instalada. */
type NotesView = { version: string; notes: string | null; installed: boolean }

/**
 * Píldora en la titlebar cuando hay versión nueva: versión, novedades e instalar.
 * El estado vive en main (electron/selfUpdate.ts); aquí solo se pinta.
 *
 * Además abre «Novedades» sola en el primer arranque tras subir de versión,
 * con la sección del CHANGELOG empaquetado.
 */
export const UpdateBanner: React.FC = () => {
  const { t } = useT()
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })
  const [view, setView] = useState<NotesView | null>(null)

  useEffect(() => {
    void window.api.getUpdateState().then(setState)
    return window.api.onUpdateState(setState)
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

  const notes = state.kind === 'available' || state.kind === 'ready' ? state.notes : null
  const canInstall = state.kind === 'available' || state.kind === 'ready'
  const install = (): void => {
    setView(null)
    window.api.installUpdate()
  }
  const openPending = (): void => {
    if (state.kind === 'idle' || state.kind === 'error') return
    setView({ version: state.version, notes, installed: false })
  }

  const label =
    state.kind === 'downloading'
      ? t('update.downloading', { percent: state.percent })
      : state.kind === 'ready'
        ? t('update.ready')
        : state.kind === 'error'
          ? t('update.error', { message: state.message })
          : t('update.available')

  return (
    <>
      {state.kind !== 'idle' && (
        <div className="update-banner">
          <span className="update-banner__pulse" aria-hidden="true" />
          <span className="update-banner__label">{label}</span>

          {state.kind !== 'error' && (
            <button
              type="button"
              className="update-banner__version"
              aria-label={t('update.notesTitle')}
              onClick={openPending}
            >
              v{state.version}
            </button>
          )}

          {canInstall && notes && (
            <button type="button" className="update-banner__whatsnew" onClick={openPending}>
              {t('update.whatsNew')}
            </button>
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
              onClick={() => window.api.dismissUpdate()}
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
