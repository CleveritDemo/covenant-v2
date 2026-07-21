import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import type { PreviewState } from './TabContextsEditor'

interface Props {
  context: TabContext | null
  preview: PreviewState
  countAutoKeys: (content: string) => number
  countAnnotations: (content: string) => number
}

/** Panel derecho del modal de listado: vista previa del contexto seleccionado. */
export const TabContextsListPreview: React.FC<Props> = ({
  context,
  preview,
  countAutoKeys,
  countAnnotations,
}) => {
  const { t } = useT()

  if (!context) {
    return (
      <section className="tab-contexts__preview-pane">
        <p className="tab-contexts__preview-empty">{t('tabContexts.selectToPreview')}</p>
      </section>
    )
  }

  return (
    <section className="tab-contexts__preview-pane">
      <header className="tab-contexts__preview-header">
        <strong>{context.name}</strong>
        <span>{t(`tabContexts.kind_${context.kind}`)}</span>
        <span className="tab-contexts__item-file">{context.fileName}</span>
      </header>

      {preview.status === 'idle' && (
        <p className="tab-contexts__preview-empty">{t('tabContexts.selectToPreview')}</p>
      )}
      {preview.status === 'loading' && (
        <div className="tab-contexts__preview-panel tab-contexts__preview-panel--loading">
          <p>{t('tabContexts.loading')}</p>
        </div>
      )}
      {preview.status === 'empty' && (
        <div className="tab-contexts__preview-panel tab-contexts__preview-panel--empty">
          <p>{t('tabContexts.previewEmpty')}</p>
          {preview.filePath && <small>{preview.filePath}</small>}
        </div>
      )}
      {preview.status === 'error' && (
        <div className="tab-contexts__preview-panel tab-contexts__preview-panel--error">
          <p>{preview.message}</p>
        </div>
      )}
      {preview.status === 'success' && (
        <div className="tab-contexts__preview-panel tab-contexts__preview-panel--success">
          <div className="tab-contexts__preview-meta">
            <small>{preview.filePath}</small>
            <small>
              {t('tabContexts.previewStats', {
                auto: countAutoKeys(preview.content),
                notes: countAnnotations(preview.content),
              })}
            </small>
          </div>
          <pre className="tab-contexts__preview">{preview.content}</pre>
        </div>
      )}
    </section>
  )
}
