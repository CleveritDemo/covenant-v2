import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { FilePreviewStatus } from './FilePreview'
import { useFileBytes } from './useFileBytes'

type Parsed =
  | { status: 'parsing' }
  | { status: 'ready'; html: string }
  | { status: 'error'; message: string }

/**
 * Vista de un .docx. mammoth convierte a HTML semántico (encabezados, listas,
 * tablas) y se carga con `import()` dinámico para no engordar el bundle inicial.
 *
 * El HTML resultante se pinta dentro de un iframe aislado en lugar de inyectarlo
 * en el DOM de la app: mammoth no sanea, y un documento manipulado podría traer
 * markup activo. `sandbox=""` lo deja sin scripts, sin formularios y sin red.
 */
export const DocxPreview: React.FC<{ sessionId: string; relPath: string }> = ({
  sessionId,
  relPath,
}) => {
  const { t } = useT()
  const bytesState = useFileBytes(sessionId, relPath, 'docx')
  const [parsed, setParsed] = useState<Parsed>({ status: 'parsing' })

  useEffect(() => {
    if (bytesState.status !== 'ready') return
    let cancelled = false
    setParsed({ status: 'parsing' })

    void (async () => {
      try {
        // mammoth no publica tipos para su entrada de navegador.
        // @ts-expect-error -- sin declaración; la forma se acota justo debajo.
        const mod = await import('mammoth/mammoth.browser.js') as unknown as {
          default?: { convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
          convertToHtml?: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
        }
        const mammoth = mod.default ?? mod
        if (!mammoth.convertToHtml) throw new Error('mammoth sin convertToHtml')
        // Copia a un ArrayBuffer propio: `bytes` puede ser una vista sobre uno mayor.
        const copy = bytesState.bytes.slice()
        if (cancelled) return
        const result = await mammoth.convertToHtml({ arrayBuffer: copy.buffer as ArrayBuffer })
        if (cancelled) return
        setParsed({ status: 'ready', html: result.value })
      } catch (e) {
        if (!cancelled) {
          setParsed({ status: 'error', message: e instanceof Error ? e.message : String(e) })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bytesState])

  if (bytesState.status !== 'ready') return <FilePreviewStatus state={bytesState} />
  if (parsed.status === 'parsing') {
    return <div className="file-preview__center file-preview__message">{t('fileExplorer.preview.loading')}</div>
  }
  if (parsed.status === 'error') {
    return (
      <div className="file-preview__center file-preview__message file-preview__message--error" role="alert">
        {t('fileExplorer.preview.error', { message: parsed.message })}
      </div>
    )
  }
  if (!parsed.html.trim()) {
    return (
      <div className="file-preview__center file-preview__message">
        {t('fileExplorer.preview.emptyDocument')}
      </div>
    )
  }

  return (
    <iframe
      className="file-preview__doc"
      sandbox=""
      referrerPolicy="no-referrer"
      title={t('fileExplorer.preview.docTitle')}
      srcDoc={`<!doctype html><meta charset="utf-8"><style>
        body{margin:0;padding:24px 28px;font:14px/1.6 -apple-system,system-ui,sans-serif;color:#1a1a1a;background:#fff}
        h1,h2,h3{line-height:1.25}
        table{border-collapse:collapse}
        td,th{border:1px solid #ddd;padding:4px 8px}
        img{max-width:100%}
      </style>${parsed.html}`}
    />
  )
}
