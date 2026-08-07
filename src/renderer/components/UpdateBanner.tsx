import React, { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/updateState'
import { useT } from '@i18n/useT'
import { AiMarkdown } from './AiMarkdown'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import './UpdateBanner.css'

/**
 * Píldora en la titlebar cuando hay versión nueva: versión, novedades e instalar.
 * El estado vive en main (electron/selfUpdate.ts); aquí solo se pinta.
 */
export const UpdateBanner: React.FC = () => {
  const { t } = useT()
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    void window.api.getUpdateState().then(setState)
    return window.api.onUpdateState(setState)
  }, [])

  if (state.kind === 'idle') return null

  const notes = state.kind === 'available' || state.kind === 'ready' ? state.notes : null
  const canInstall = state.kind === 'available' || state.kind === 'ready'
  const install = (): void => {
    setNotesOpen(false)
    window.api.installUpdate()
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
    <div className="update-banner">
      <span className="update-banner__pulse" aria-hidden="true" />
      <span className="update-banner__label">{label}</span>

      {state.kind !== 'error' && (
        <button
          type="button"
          className="update-banner__version"
          aria-label={t('update.notesTitle')}
          onClick={() => setNotesOpen(true)}
        >
          v{state.version}
        </button>
      )}

      {canInstall && notes && (
        <button type="button" className="update-banner__whatsnew" onClick={() => setNotesOpen(true)}>
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

      <TerminalModal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        size="md"
        closeOnEscape
        closeOnBackdrop
        title={state.kind === 'error' ? t('update.notesTitle') : `${t('update.whatsNewTitle')} · v${state.version}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setNotesOpen(false)}>
              {t('update.later')}
            </Button>
            {canInstall && (
              <Button variant="primary" size="sm" onClick={install}>
                {state.kind === 'ready' ? t('update.restart') : t('update.install')}
              </Button>
            )}
          </>
        }
      >
        {notes
          ? <AiMarkdown content={notes} />
          : <p className="update-banner__empty">{t('update.noNotes')}</p>}
      </TerminalModal>
    </div>
  )
}
