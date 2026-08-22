import React, { useEffect } from 'react'
import { useT } from '@i18n/useT'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { Tooltip } from '../components/ui/Tooltip'
import './PreviewsView.css'

export interface PreviewsViewEntry {
  fileName: string
  title: string
  subtitle: string
}

export interface PreviewsViewProps {
  open: boolean
  entries: PreviewsViewEntry[]
  selectedFileName: string | null
  html: string | null
  loading?: boolean
  error?: string | null
  onSelect: (fileName: string) => void
  onDelete?: (fileName: string) => void
  onClose: () => void
}

/** Galería de previews HTML del workspace — presentacional; otra lane cablea datos e IPC. */
export const PreviewsView: React.FC<PreviewsViewProps> = ({
  open,
  entries,
  selectedFileName,
  html,
  loading = false,
  error = null,
  onSelect,
  onDelete,
  onClose,
}) => {
  const { t } = useT()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.terminal-modal-root')) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const empty = entries.length === 0

  return (
    <div
      className="previews-view"
      role="region"
      aria-label={t('previews.title')}
      style={{ zIndex: APP_OVERLAY_MODAL_Z }}
    >
      <header className="previews-view__bar">
        <span className="previews-view__title">{t('previews.title')}</span>
        <Tooltip content={t('previews.close')}>
          <button
            type="button"
            className="previews-view__icon"
            aria-label={t('previews.close')}
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>
      </header>

      {empty ? (
        <div className="previews-view__empty">
          <p className="previews-view__empty-title">{t('previews.empty')}</p>
          <p className="previews-view__empty-hint">{t('previews.emptyHint')}</p>
        </div>
      ) : (
        <div className="previews-view__body">
          <div className="previews-view__list" role="listbox" aria-label={t('previews.title')}>
            {entries.map(entry => {
              const selected = entry.fileName === selectedFileName
              return (
                <button
                  key={entry.fileName}
                  type="button"
                  role="option"
                  className={[
                    'previews-view__item',
                    selected ? 'previews-view__item--selected' : '',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={selected}
                  onClick={() => onSelect(entry.fileName)}
                >
                  <span className="previews-view__item-title">{entry.title}</span>
                  <span className="previews-view__item-sub">{entry.subtitle}</span>
                  {onDelete ? (
                    <button
                      type="button"
                      className="previews-view__delete"
                      aria-label={t('previews.delete')}
                      onClick={event => {
                        event.stopPropagation()
                        onDelete(entry.fileName)
                      }}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="previews-view__viewer">
            {loading ? (
              <div className="previews-view__center">
                <Spinner aria-label={t('previews.loading')} />
              </div>
            ) : error ? (
              <div className="previews-view__center previews-view__center--error" role="alert">
                {error}
              </div>
            ) : html === null ? (
              <div className="previews-view__center">{t('previews.pick')}</div>
            ) : (
              <iframe
                className="previews-view__iframe"
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                title={t('previews.title')}
                srcDoc={html}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
