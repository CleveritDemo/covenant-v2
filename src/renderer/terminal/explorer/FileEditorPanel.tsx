import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../../components/ui/Icon'
import { ExplorerToolButton } from './ExplorerToolButton'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { FileCodeEditor, type FileCodeEditorHandle } from './FileCodeEditor'
import { fileExplorerErrorMessage } from './fileExplorerErrorI18n'

const SAVE_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘S'
    : 'Ctrl+S'

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
  onFileSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onClose?: () => void
}

export const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  sessionId,
  themeId,
  selectedPath,
  fsReloadToken = 0,
  onFileSaved,
  onDirtyChange,
  onClose,
}) => {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [isBinary, setIsBinary] = useState(false)
  const [largeFileInfo, setLargeFileInfo] = useState<{ sizeBytes: number; maxBytes: number } | null>(null)
  const [diskConflict, setDiskConflict] = useState(false)
  const editorRef = useRef<FileCodeEditorHandle>(null)
  const findInputRef = useRef<HTMLInputElement>(null)

  const isDirty = draftContent !== savedContent
  const saveHint = useMemo(() => {
    if (saving) return t('common.saving')
    return `${t('fileExplorer.editor.saveHint')} · ${SAVE_SHORTCUT_LABEL}`
  }, [saving, t])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    setFindQuery('')
    setMatchCount(0)
    setIsBinary(false)
    setLargeFileInfo(null)
    setDiskConflict(false)
  }, [selectedPath])

  const focusFindInput = useCallback(() => {
    findInputRef.current?.focus()
    findInputRef.current?.select()
  }, [])

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
          title={selectedPath}
        >
          {selectedPath}
          {isDirty && (
            <span className="file-editor-panel__unsaved" title={t('fileExplorer.editor.unsaved')}>
              {' '}•
            </span>
          )}
        </code>
        <span className="file-editor-panel__save-hint" title={`${SAVE_SHORTCUT_LABEL}`}>
          {saveHint}
        </span>
        {onClose && (
          <ExplorerToolButton
            variant="close"
            title={t('fileExplorer.editor.closeFile')}
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
          <button
            type="button"
            className="file-editor-panel__special-btn"
            onClick={() => { void loadFile() }}
          >
            {t('fileExplorer.editor.reloadFromDisk')}
          </button>
          <button
            type="button"
            className="file-editor-panel__special-btn"
            onClick={() => setDiskConflict(false)}
          >
            {t('fileExplorer.editor.keepEditing')}
          </button>
        </div>
      )}

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
            <button
              type="button"
              className="file-editor-panel__special-btn"
              onClick={() => { void loadFile(true) }}
            >
              {t('fileExplorer.editor.openLargeAnyway')}
            </button>
          </div>
        )}
        {!loading && isBinary && (
          <div className="file-editor-panel__special">
            <p className="file-editor-panel__special-title">{t('fileExplorer.editor.binaryTitle')}</p>
            <p className="file-editor-panel__special-hint">{t('fileExplorer.editor.binaryHint')}</p>
            <button
              type="button"
              className="file-editor-panel__special-btn"
              onClick={() => { void window.api.fileExplorerReveal(sessionId, selectedPath) }}
            >
              {t('fileExplorer.editor.revealBinary')}
            </button>
          </div>
        )}
        {!loading && error && (
          <p className="file-editor-panel__error" role="alert">{error}</p>
        )}
        {!loading && saveError && (
          <p className="file-editor-panel__error" role="alert">{saveError}</p>
        )}
        {!loading && !error && !isBinary && !largeFileInfo && (
          <FileCodeEditor
            ref={editorRef}
            key={selectedPath}
            filePath={selectedPath}
            themeId={themeId}
            content={draftContent}
            findQuery={findQuery}
            onChange={setDraftContent}
            onSave={() => void handleSave()}
            onMatchCountChange={setMatchCount}
            onFindFocusRequest={focusFindInput}
          />
        )}
      </div>

      {!loading && !error && !isBinary && !largeFileInfo && (
        <div className="file-editor-panel__search" role="search">
          <div className="file-editor-panel__search-field">
            <Input
              ref={findInputRef}
              type="text"
              size="sm"
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (e.shiftKey) editorRef.current?.findPrevious()
                  else editorRef.current?.findNext()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setFindQuery('')
                  e.currentTarget.blur()
                }
              }}
              placeholder={t('fileExplorer.editor.findPlaceholder')}
              aria-label={t('fileExplorer.editor.findAria')}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          {findQuery.trim() !== '' && (
            <span className="file-editor-panel__search-meta" aria-live="polite">
              {matchCount === 0
                ? t('fileExplorer.editor.noMatches')
                : t('fileExplorer.editor.matchCount', { count: matchCount })}
            </span>
          )}
          <button
            type="button"
            className="file-editor-panel__search-nav file-editor-panel__search-nav--up"
            title="Shift+Enter"
            aria-label={t('fileExplorer.editor.findAria')}
            disabled={!findQuery.trim() || matchCount === 0}
            onClick={() => editorRef.current?.findPrevious()}
          >
            <Icon name="chevron-down" size={10} aria-hidden />
          </button>
          <button
            type="button"
            className="file-editor-panel__search-nav"
            title="Enter"
            aria-label={t('fileExplorer.editor.findAria')}
            disabled={!findQuery.trim() || matchCount === 0}
            onClick={() => editorRef.current?.findNext()}
          >
            <Icon name="chevron-down" size={10} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
