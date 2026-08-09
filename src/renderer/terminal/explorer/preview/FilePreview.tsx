import React, { useMemo } from 'react'
import { useT } from '@i18n/useT'
import type { FilePreviewKind } from '@shared/filePreviewKind'
import { AiMarkdown } from '../../../components/AiMarkdown'
import { Spinner } from '../../../components/ui/Spinner'
import { CsvPreview } from './CsvPreview'
import { DocxPreview } from './DocxPreview'
import { XlsxPreview } from './XlsxPreview'
import { useBlobUrl, useFileBytes, type FileBytesState } from './useFileBytes'
import './filePreview.css'

export interface FilePreviewProps {
  kind: FilePreviewKind
  sessionId: string
  relPath: string
  /** Texto del buffer vivo; sólo lo usan los visores de formatos de texto. */
  content: string
  /** Edición desde la vista (hoy sólo CSV); el panel es dueño del estado dirty. */
  onChange?: (content: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Estados comunes de carga de bytes, para no repetirlos en cada visor binario.
 * Acepta sólo los estados NO listos: pintar "cargando" sobre bytes ya cargados
 * sería un bug, y el tipo lo impide en vez de dejarlo a la disciplina.
 */
export const FilePreviewStatus: React.FC<{ state: Exclude<FileBytesState, { status: 'ready' }> }> = ({ state }) => {
  const { t } = useT()
  if (state.status === 'loading') {
    return (
      <div className="file-preview__center">
        <Spinner aria-label={t('fileExplorer.preview.loading')} />
      </div>
    )
  }
  if (state.status === 'too-large') {
    return (
      <div className="file-preview__center file-preview__message">
        {t('fileExplorer.preview.tooLarge', {
          size: formatBytes(state.sizeBytes),
          max: formatBytes(state.maxBytes),
        })}
      </div>
    )
  }
  return (
    <div className="file-preview__center file-preview__message file-preview__message--error" role="alert">
      {t('fileExplorer.preview.error', { message: state.message })}
    </div>
  )
}

const ImagePreview: React.FC<{ sessionId: string; relPath: string }> = ({ sessionId, relPath }) => {
  const state = useFileBytes(sessionId, relPath, 'image')
  const bytes = state.status === 'ready' ? state.bytes : null
  // Sin mime explícito: el navegador lo deduce de los bytes, que es lo correcto
  // cuando la extensión miente.
  const url = useBlobUrl(bytes)
  const { t } = useT()

  if (state.status !== 'ready') return <FilePreviewStatus state={state} />
  if (!url) return null
  return (
    <div className="file-preview__center file-preview__image-wrap">
      <img className="file-preview__image" src={url} alt={t('fileExplorer.preview.imageAlt')} />
    </div>
  )
}

const PdfPreview: React.FC<{ sessionId: string; relPath: string }> = ({ sessionId, relPath }) => {
  const state = useFileBytes(sessionId, relPath, 'pdf')
  const bytes = state.status === 'ready' ? state.bytes : null
  const url = useBlobUrl(bytes, 'application/pdf')
  const { t } = useT()

  if (state.status !== 'ready') return <FilePreviewStatus state={state} />
  if (!url) return null
  // Visor de PDF nativo de Chromium; no hay librería de por medio.
  return <iframe className="file-preview__pdf" src={url} title={t('fileExplorer.preview.pdfTitle')} />
}

/**
 * SVG parseado con `DOMParser` en vez de volcado con `innerHTML`: así los
 * `<script>` incrustados nunca llegan a ejecutarse. Son archivos locales, pero
 * la garantía sale gratis.
 */
const SvgPreview: React.FC<{ content: string }> = ({ content }) => {
  const { t } = useT()
  const parsed = useMemo(() => {
    const doc = new DOMParser().parseFromString(content, 'image/svg+xml')
    const err = doc.querySelector('parsererror')
    const root = doc.documentElement
    if (err || !root || root.nodeName.toLowerCase() !== 'svg') {
      return { error: err?.textContent?.trim() || 'SVG inválido', markup: '' }
    }
    doc.querySelectorAll('script').forEach(s => s.remove())
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return { error: null, markup: new XMLSerializer().serializeToString(root) }
  }, [content])

  if (parsed.error) {
    return (
      <div className="file-preview__center file-preview__message file-preview__message--error" role="alert">
        {t('fileExplorer.preview.svgInvalid', { message: parsed.error })}
      </div>
    )
  }
  // El markup ya pasó por DOMParser y perdió sus <script>; el `srcDoc` de un
  // iframe aislado lo mantiene fuera del DOM de la app.
  return (
    <iframe
      className="file-preview__svg"
      sandbox=""
      referrerPolicy="no-referrer"
      title={t('fileExplorer.preview.svgTitle')}
      srcDoc={`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:transparent}svg{max-width:100%;max-height:100%;height:auto}</style>${parsed.markup}`}
    />
  )
}

/**
 * HTML dentro de un iframe aislado. `allow-scripts` + `allow-same-origin` para
 * que Tailwind por CDN o un `<script>` inline se comporten como en un navegador;
 * popups y formularios quedan fuera a propósito: una vista previa no debe abrir
 * ventanas ni enviar nada a ningún sitio.
 */
const HtmlPreview: React.FC<{ content: string }> = ({ content }) => {
  const { t } = useT()
  return (
    <iframe
      className="file-preview__html"
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      title={t('fileExplorer.preview.htmlTitle')}
      srcDoc={content}
    />
  )
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  kind,
  sessionId,
  relPath,
  content,
  onChange,
}) => {
  switch (kind) {
    case 'markdown':
      return (
        <div className="file-preview__markdown">
          <AiMarkdown content={content} />
        </div>
      )
    case 'svg':
      return <SvgPreview content={content} />
    case 'html':
      return <HtmlPreview content={content} />
    case 'image':
      return <ImagePreview sessionId={sessionId} relPath={relPath} />
    case 'pdf':
      return <PdfPreview sessionId={sessionId} relPath={relPath} />
    case 'csv':
      return <CsvPreview relPath={relPath} content={content} onChange={onChange} />
    case 'xlsx':
      return <XlsxPreview sessionId={sessionId} relPath={relPath} />
    case 'docx':
      return <DocxPreview sessionId={sessionId} relPath={relPath} />
    default:
      return null
  }
}
