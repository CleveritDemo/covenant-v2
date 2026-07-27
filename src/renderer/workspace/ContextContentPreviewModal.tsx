import React, { useEffect, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { collectAutoAnnotationKeys } from '@shared/tabContext'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import type { PreviewState } from '../agent/TabContextsEditor'
import '../agent/AgentPane.css'
import './ContextContentPreviewModal.css'

export interface ContextContentPreviewModalProps {
  open: boolean
  context: TabContext | null
  cwd: string
  onClose: () => void
}

function countAutoKeys(content: string): number {
  const auto = content.match(/<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/)?.[1] ?? ''
  return collectAutoAnnotationKeys(auto).size
}

function countAnnotations(content: string): number {
  const notes = content.match(/<!-- iaterminal:notes -->([\s\S]*?)<!-- \/iaterminal:notes -->/)?.[1] ?? ''
  return [...notes.matchAll(/^-\s+`[^`]+`\s+—\s+/gm)].length
}

/** Vista previa solo lectura del Markdown de un contexto (p. ej. results de agente). */
export const ContextContentPreviewModal: React.FC<ContextContentPreviewModalProps> = ({
  open,
  context,
  cwd,
  onClose,
}) => {
  const { t } = useT()
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })

  useEffect(() => {
    if (!open || !context) {
      setPreview({ status: 'idle' })
      return
    }
    const workingCwd = cwd.trim()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    let cancelled = false
    setPreview({ status: 'loading' })
    void window.api.previewTabContext({ context, cwd: workingCwd }).then(result => {
      if (cancelled) return
      if (!result.ok) {
        setPreview({
          status: 'error',
          message: result.error?.trim() || t('tabContexts.previewError'),
        })
        return
      }
      const content = result.content ?? ''
      if (!content.trim()) {
        setPreview({ status: 'empty', filePath: result.filePath })
        return
      }
      setPreview({
        status: 'success',
        content,
        filePath: result.filePath ?? context.fileName,
      })
    }).catch(error => {
      if (cancelled) return
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, context, cwd, t])

  const title = context
    ? `${context.name} · ${t(`tabContexts.kind_${context.kind}`)}`
    : t('tabContexts.preview')

  return (
    <TerminalModal
      open={open && Boolean(context)}
      onClose={onClose}
      title={title}
      titleId="context-content-preview-title"
      size="xl"
      bodyLayout="flush"
      closeOnBackdrop
      zIndex={APP_OVERLAY_MODAL_Z}
    >
      <div className="context-content-preview">
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
            {preview.filePath ? <small>{preview.filePath}</small> : null}
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
      </div>
    </TerminalModal>
  )
}
