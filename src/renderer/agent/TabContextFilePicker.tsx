import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { Button, Input } from '../components/ui'
import './TabContextFilePicker.css'

const SEARCH_DEBOUNCE_MS = 140
const MAX_SUGGESTIONS = 8

export interface TabContextFilePickerProps {
  cwd: string
  rootPath?: string
  paths: string[]
  onAdd: (paths: string[]) => void
  onError?: (message: string) => void
}

type SelectProjectFilesResult =
  | { ok: true; paths: string[] }
  | { ok: false; cancelled?: boolean; error?: string }

/**
 * Kenneth agrega `selectProjectFiles` en la misma tanda; el tipo de preload
 * puede no estar en este árbol todavía.
 */
function selectProjectFiles(options: {
  cwd: string
  rootPath?: string
  title: string
}): Promise<SelectProjectFilesResult> {
  const api = window.api as typeof window.api & {
    selectProjectFiles: (options: {
      cwd: string
      rootPath?: string
      title: string
    }) => Promise<SelectProjectFilesResult>
  }
  return api.selectProjectFiles(options)
}

/**
 * Buscador + diálogo nativo para agregar rutas relativas al textarea de un
 * contexto files/symbols/spreadsheet. No copia: solo referencia.
 */
export const TabContextFilePicker: React.FC<TabContextFilePickerProps> = ({
  cwd,
  rootPath,
  paths,
  onAdd,
  onError,
}) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [fileHits, setFileHits] = useState<string[]>([])
  const [hitsReady, setHitsReady] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmedCwd = cwd.trim()
  const trimmedRootPath = rootPath?.trim() ?? ''
  const root = trimmedRootPath && trimmedRootPath !== '.'
    ? `${trimmedCwd}/${trimmedRootPath}`
    : trimmedCwd
  const disabled = !trimmedCwd

  const existing = useMemo(
    () => new Set(paths.map(path => path.trim()).filter(Boolean)),
    [paths],
  )

  useEffect(() => {
    const q = query.trim()
    if (!root || q.length < 2) {
      setFileHits([])
      setHitsReady(false)
      return
    }
    let cancelled = false
    setHitsReady(false)
    const timer = window.setTimeout(() => {
      void window.api.searchProjectFiles(root, q).then(result => {
        if (cancelled) return
        setFileHits(result.ok
          ? (result.hits ?? []).filter(hit => hit.isDirectory === false).map(hit => hit.relPath)
          : [])
        setHitsReady(true)
      }).catch(() => {
        if (!cancelled) {
          setFileHits([])
          setHitsReady(true)
        }
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [root, query])

  const suggestions = useMemo(
    () => fileHits.filter(path => !existing.has(path)).slice(0, MAX_SUGGESTIONS),
    [fileHits, existing],
  )

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  const addNew = (incoming: string[]): void => {
    const fresh = incoming.map(path => path.trim()).filter(path => path && !existing.has(path))
    if (!fresh.length) return
    onAdd(fresh)
  }

  const addSuggestion = (path: string): void => {
    addNew([path])
    setQuery('')
    setFileHits([])
    setHitsReady(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(0, suggestions.length - 1)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(0, index - 1))
      return
    }
    if (event.key === 'Enter') {
      const picked = suggestions[activeIndex]
      if (picked) {
        event.preventDefault()
        event.stopPropagation()
        addSuggestion(picked)
      }
      return
    }
    if (event.key === 'Escape' && query) {
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
    }
  }

  const pickFromDialog = async (): Promise<void> => {
    onError?.('')
    if (!trimmedCwd) return
    const result = await selectProjectFiles({
      cwd: trimmedCwd,
      ...(trimmedRootPath ? { rootPath: trimmedRootPath } : {}),
      title: t('tabContexts.pickProjectFilesTitle'),
    })
    if (result.ok) {
      addNew(result.paths)
      return
    }
    if (result.cancelled) return
    if (result.error === 'outside project folder') {
      onError?.(t('tabContexts.pickOutsideProject'))
      return
    }
    onError?.(result.error ?? t('tabContexts.previewError'))
  }

  const showEmpty = hitsReady && query.trim().length >= 2 && suggestions.length === 0

  return (
    <div className="tab-context-file-picker">
      <div className="tab-context-file-picker__row">
        <div className="tab-context-file-picker__search">
          <Input
            ref={inputRef}
            size="sm"
            value={query}
            disabled={disabled}
            placeholder={t('tabContexts.addFileSearch')}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => { void pickFromDialog() }}
        >
          {t('tabContexts.pickProjectFiles')}
        </Button>
      </div>

      {suggestions.length ? (
        <ul className="tab-context-file-picker__menu" role="listbox">
          {suggestions.map((path, index) => (
            <li key={path}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex
                  ? 'tab-context-file-picker__option tab-context-file-picker__option--active'
                  : 'tab-context-file-picker__option'}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => addSuggestion(path)}
              >
                {path}
              </button>
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <p className="tab-context-file-picker__empty">{t('tabContexts.addFileNoResults')}</p>
      ) : null}
    </div>
  )
}
