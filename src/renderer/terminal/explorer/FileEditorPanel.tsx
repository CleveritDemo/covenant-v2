import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../../components/ui/Icon'
import { ExplorerToolButton } from './ExplorerToolButton'
import { FileEditorActionButton } from './FileEditorActionButton'
import { Spinner } from '../../components/ui/Spinner'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Tooltip } from '../../components/ui/Tooltip'
import { FileCodeEditor } from './FileCodeEditor'
import { LspStatusBanner } from '../../lsp/LspStatusBanner'
import type { LspDocStatus } from '../../lsp/manager'
import { lspLanguageId } from '@shared/lspLanguages'
import { filePreviewKindForPath, previewHasSource } from '@shared/filePreviewKind'
import { FilePreview } from './preview/FilePreview'
import { fileExplorerErrorMessage } from './fileExplorerErrorI18n'

const SAVE_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘S'
    : 'Ctrl+S'

/** Estados LSP que dibuja el chip; el resto los explica el banner. */
const CHIP_KINDS: string[] = ['ready', 'starting', 'downloading']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileEditorPanelProps {
  sessionId: string
  themeId: string
  selectedPath: string | null
  /** Incrementar para recargar desde disco si el archivo no está dirty. */
  fsReloadToken?: number
  /** Salto a una línea 1-based (go-to-definition, panel de referencias). */
  gotoTarget?: { line: number; nonce: number }
  onFileSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onClose?: () => void
  /** Abre otro archivo del proyecto (ruta relativa a la raíz de la sesión). */
  onOpenFile?: (relPath: string, line: number) => void
}

export const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  sessionId,
  themeId,
  selectedPath,
  fsReloadToken = 0,
  gotoTarget,
  onFileSaved,
  onDirtyChange,
  onClose,
  onOpenFile,
}) => {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isBinary, setIsBinary] = useState(false)
  const [largeFileInfo, setLargeFileInfo] = useState<{ sizeBytes: number; maxBytes: number } | null>(null)
  const [diskConflict, setDiskConflict] = useState(false)
  const [lspStatus, setLspStatus] = useState<LspDocStatus | null>(null)
  const [lspRetryToken, setLspRetryToken] = useState(0)
  const [showSource, setShowSource] = useState(false)

  const lspLanguage = selectedPath ? lspLanguageId(selectedPath) : null
  const previewKind = selectedPath ? filePreviewKindForPath(selectedPath) : null
  const hasSource = previewKind === null || previewHasSource(previewKind)
  // Los binarios no tienen fuente que enseñar: el visor es la única vista.
  const viewingSource = previewKind === null || (hasSource && showSource)

  const isDirty = draftContent !== savedContent
  const saveHint = useMemo(() => {
    if (saving) return t('common.saving')
    return `${t('fileExplorer.editor.saveHint')} · ${SAVE_SHORTCUT_LABEL}`
  }, [saving, t])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    setIsBinary(false)
    setLargeFileInfo(null)
    setDiskConflict(false)
    setLspStatus(null)
    setShowSource(false)
  }, [selectedPath])

  const loadGenRef = useRef(0)

  const loadFile = useCallback(async (allowLarge = false, pathOverride?: string): Promise<void> => {
    const path = pathOverride ?? selectedPath
    if (!path) return
    const gen = ++loadGenRef.current
    setLoading(true)
    setError(null)
    setSaveError(null)
    setIsBinary(false)
    setLargeFileInfo(null)
    try {
      const payload = await window.api.fileExplorerLoadFile(
        sessionId,
        path,
        allowLarge ? { allowLarge: true } : undefined,
      )
      if (gen !== loadGenRef.current) return
      if (!payload.ok) {
        if (payload.code === 'FILE_TOO_LARGE' && payload.sizeBytes && payload.maxBytes) {
          setLargeFileInfo({ sizeBytes: payload.sizeBytes, maxBytes: payload.maxBytes })
          setDraftContent('')
          setSavedContent('')
          return
        }
        setError(fileExplorerErrorMessage(t, payload.error, payload.code, {
          max: payload.maxBytes ? formatBytes(payload.maxBytes) : '600 KB',
        }))
        setDraftContent('')
        setSavedContent('')
        return
      }
      if (payload.binary) {
        setIsBinary(true)
        setDraftContent('')
        setSavedContent('')
        return
      }
      const text = payload.content ?? ''
      setDraftContent(text)
      setSavedContent(text)
      setDiskConflict(false)
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [sessionId, selectedPath, t])

  useEffect(() => {
    if (!selectedPath) {
      loadGenRef.current += 1
      setDraftContent('')
      setSavedContent('')
      setError(null)
      setSaveError(null)
      setDiskConflict(false)
      return
    }
    void loadFile()
  }, [selectedPath, loadFile])

  useEffect(() => {
    if (!fsReloadToken || !selectedPath) return
    if (draftContent !== savedContent) {
      setDiskConflict(true)
      return
    }
    void loadFile()
  }, [fsReloadToken, selectedPath, draftContent, savedContent, loadFile])

  const handleSave = useCallback(async () => {
    if (!selectedPath || !isDirty || saving) return
    setSaving(true)
    setSaveError(null)
    const result = await window.api.fileExplorerSaveFile(sessionId, selectedPath, draftContent)
    setSaving(false)
    if (!result.ok) {
      setSaveError(fileExplorerErrorMessage(t, result.error, result.code))
      return
    }
    setSavedContent(draftContent)
    onFileSaved?.()
  }, [sessionId, selectedPath, draftContent, isDirty, saving, onFileSaved, t])

  if (!selectedPath) {
    return (
      <div className="file-editor-panel file-editor-panel--empty">
        <p className="file-editor-panel__hint">{t('fileExplorer.editor.selectHint')}</p>
      </div>
    )
  }

  return (
    <div className="file-editor-panel">
      <div className="file-editor-panel__header">
        <code
          className={[
            'file-editor-panel__path',
            isDirty ? 'file-editor-panel__path--dirty' : '',
          ].filter(Boolean).join(' ')}
        >
          {selectedPath}
          {isDirty && (
            <span className="file-editor-panel__unsaved">
              {' '}•
            </span>
          )}
        </code>
        {previewKind && hasSource && (
          <SegmentedControl
            size="sm"
            value={showSource ? 'source' : 'preview'}
            onChange={next => setShowSource(next === 'source')}
            options={[
              { value: 'preview', label: t('fileExplorer.preview.tabPreview') },
              { value: 'source', label: t('fileExplorer.preview.tabSource') },
            ]}
            label={t('fileExplorer.preview.tabsAria')}
          />
        )}
        <span className="file-editor-panel__save-hint">
          {saveHint}
        </span>
        {/* El chip es el estado AMBIENTE; los estados accionables
            (consent-needed, needs-runtime, error) los explica el banner de
            abajo con su botón. Mostrar ambos hacía que un «LSP OFF» conviviera
            con un «Descargar» y se leyera como que la función está apagada. */}
        {lspLanguage && lspStatus && CHIP_KINDS.includes(lspStatus.kind) && (
          <Tooltip content={lspLanguage}>
            <span
              className={['lsp-chip', lspStatus.kind === 'ready' ? 'lsp-chip--ready' : '']
                .filter(Boolean).join(' ')}
            >
              {t(`lsp.chip.${lspStatus.kind as 'ready' | 'starting' | 'downloading'}`)}
            </span>
          </Tooltip>
        )}
        {onClose && (
          <ExplorerToolButton
            variant="close"
            aria-label={t('fileExplorer.editor.closeFileAria')}
            onClick={onClose}
          >
            <Icon name="close" size={9} aria-hidden />
          </ExplorerToolButton>
        )}
      </div>

      {diskConflict && (
        <div className="file-editor-panel__disk-banner" role="status">
          <span>{t('fileExplorer.editor.diskChanged')}</span>
          <FileEditorActionButton
            label={t('fileExplorer.editor.reloadFromDisk')}
            onClick={() => { void loadFile() }}
          />
          <FileEditorActionButton
            label={t('fileExplorer.editor.keepEditing')}
            onClick={() => setDiskConflict(false)}
          />
        </div>
      )}

      <LspStatusBanner
        status={lspStatus}
        language={lspLanguage}
        onRetry={() => setLspRetryToken(n => n + 1)}
      />

      <div className="file-editor-panel__body">
        {loading && (
          <div className="file-editor-panel__loading">
            <Spinner aria-label={t('fileExplorer.editor.loading')} />
          </div>
        )}
        {!loading && largeFileInfo && (
          <div className="file-editor-panel__special">
            <p className="file-editor-panel__special-title">{t('fileExplorer.editor.largeFileTitle')}</p>
            <p className="file-editor-panel__special-hint">
              {t('fileExplorer.editor.largeFileHint', {
                size: formatBytes(largeFileInfo.sizeBytes),
                max: formatBytes(largeFileInfo.maxBytes),
              })}
            </p>
            <FileEditorActionButton
              label={t('fileExplorer.editor.openLargeAnyway')}
              onClick={() => { void loadFile(true) }}
            />
          </div>
        )}
        {!loading && isBinary && !previewKind && (
          <div className="file-editor-panel__special">
            <p className="file-editor-panel__special-title">{t('fileExplorer.editor.binaryTitle')}</p>
            <p className="file-editor-panel__special-hint">{t('fileExplorer.editor.binaryHint')}</p>
            <FileEditorActionButton
              label={t('fileExplorer.editor.revealBinary')}
              onClick={() => { void window.api.fileExplorerReveal(sessionId, selectedPath) }}
            />
          </div>
        )}
        {!loading && error && (
          <p className="file-editor-panel__error" role="alert">{error}</p>
        )}
        {!loading && saveError && (
          <p className="file-editor-panel__error" role="alert">{saveError}</p>
        )}
        {!loading && !error && !largeFileInfo && previewKind && !viewingSource && (
          <div className="file-preview">
            <FilePreview
              kind={previewKind}
              sessionId={sessionId}
              relPath={selectedPath}
              content={draftContent}
              onChange={previewKind === 'csv' ? setDraftContent : undefined}
            />
          </div>
        )}
        {!loading && !error && !isBinary && !largeFileInfo && viewingSource && (
          <FileCodeEditor
            key={selectedPath}
            filePath={selectedPath}
            themeId={themeId}
            content={draftContent}
            sessionId={sessionId}
            lspRetryToken={lspRetryToken}
            gotoTarget={gotoTarget}
            onChange={setDraftContent}
            onSave={() => void handleSave()}
            onLspStatusChange={setLspStatus}
            onOpenFile={onOpenFile}
          />
        )}
      </div>

    </div>
  )
}
