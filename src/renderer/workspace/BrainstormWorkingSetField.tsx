import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { BRAINSTORM_WORKING_SET_CAP } from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { Input } from '../components/ui'
import './BrainstormWorkingSetField.css'

const SEARCH_DEBOUNCE_MS = 140
const MAX_SUGGESTIONS = 8

export interface BrainstormWorkingSetFieldProps {
  cwd: string
  contextIds: string[]
  filePaths: string[]
  onChange: (next: { contextIds: string[]; filePaths: string[] }) => void
}

interface Suggestion {
  kind: 'context' | 'file'
  /** id del contexto o ruta relativa. */
  value: string
  label: string
  tag: string
}

/**
 * Working set de una sala: contextos del proyecto + rutas del repo, un solo buscador.
 * Solo mantiene ids/rutas; main materializa al empezar cada ronda.
 */
export const BrainstormWorkingSetField: React.FC<BrainstormWorkingSetFieldProps> = ({
  cwd,
  contextIds,
  filePaths,
  onChange,
}) => {
  const { t } = useT()
  const [contexts, setContexts] = useState<TabContext[]>([])
  const [query, setQuery] = useState('')
  const [fileHits, setFileHits] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const root = cwd.trim()

  useEffect(() => {
    if (!root) return
    let cancelled = false
    void window.api.discoverTabContexts({ cwd: root }).then(result => {
      if (cancelled) return
      setContexts(result.ok ? result.contexts : [])
    }).catch(() => {
      if (!cancelled) setContexts([])
    })
    return () => { cancelled = true }
  }, [root])

  useEffect(() => {
    const q = query.trim()
    if (!root || q.length < 2) {
      setFileHits([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.api.searchProjectFiles(root, q).then(result => {
        if (cancelled) return
        // Solo archivos: una carpeta en el working set no se puede leer.
        setFileHits(result.ok
          ? result.hits.filter(hit => !hit.isDirectory).map(hit => hit.relPath)
          : [])
      }).catch(() => {
        if (!cancelled) setFileHits([])
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [root, query])

  const contextsById = useMemo(
    () => new Map(contexts.map(context => [context.id, context])),
    [contexts],
  )

  const full = contextIds.length + filePaths.length >= BRAINSTORM_WORKING_SET_CAP

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const fromContexts = contexts
      .filter(context => !contextIds.includes(context.id))
      .filter(context => `${context.kind} ${context.name}`.toLowerCase().includes(q))
      .map<Suggestion>(context => ({
        kind: 'context',
        value: context.id,
        label: context.name,
        tag: context.kind,
      }))
    const fromFiles = fileHits
      .filter(path => !filePaths.includes(path))
      .map<Suggestion>(path => ({ kind: 'file', value: path, label: path, tag: 'file' }))
    return [...fromContexts, ...fromFiles].slice(0, MAX_SUGGESTIONS)
  }, [contexts, contextIds, fileHits, filePaths, query])

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  const add = (suggestion: Suggestion): void => {
    if (full) return
    if (suggestion.kind === 'context') {
      onChange({ contextIds: [...contextIds, suggestion.value], filePaths })
    } else {
      onChange({ contextIds, filePaths: [...filePaths, suggestion.value] })
    }
    setQuery('')
    setFileHits([])
    inputRef.current?.focus()
  }

  const removeContext = (id: string): void => {
    onChange({ contextIds: contextIds.filter(item => item !== id), filePaths })
  }

  const removeFile = (path: string): void => {
    onChange({ contextIds, filePaths: filePaths.filter(item => item !== path) })
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
        add(picked)
      }
      return
    }
    if (event.key === 'Escape' && query) {
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
    }
  }

  return (
    <div className="brainstorm-working-set">
      {contextIds.length || filePaths.length ? (
        <div className="brainstorm-working-set__chips">
          {contextIds.map(id => (
            <span key={id} className="brainstorm-working-set__chip">
              <span className="brainstorm-working-set__tag">
                {contextsById.get(id)?.kind ?? 'ctx'}
              </span>
              {contextsById.get(id)?.name ?? id}
              <button
                type="button"
                className="brainstorm-working-set__remove"
                aria-label={t('tabs.brainstormWorkingSetRemove')}
                onClick={() => removeContext(id)}
              >
                ×
              </button>
            </span>
          ))}
          {filePaths.map(path => (
            <span key={path} className="brainstorm-working-set__chip">
              <span className="brainstorm-working-set__tag brainstorm-working-set__tag--file">
                file
              </span>
              {path}
              <button
                type="button"
                className="brainstorm-working-set__remove"
                aria-label={t('tabs.brainstormWorkingSetRemove')}
                onClick={() => removeFile(path)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Input
        ref={inputRef}
        size="sm"
        value={query}
        disabled={full}
        placeholder={
          full
            ? t('tabs.brainstormWorkingSetFull')
            : t('tabs.brainstormWorkingSetSearch')
        }
        onChange={event => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {suggestions.length ? (
        <ul className="brainstorm-working-set__menu" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.kind}:${suggestion.value}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex
                  ? 'brainstorm-working-set__option brainstorm-working-set__option--active'
                  : 'brainstorm-working-set__option'}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => add(suggestion)}
              >
                <span
                  className={suggestion.kind === 'file'
                    ? 'brainstorm-working-set__tag brainstorm-working-set__tag--file'
                    : 'brainstorm-working-set__tag'}
                >
                  {suggestion.tag}
                </span>
                <span className="brainstorm-working-set__option-label">{suggestion.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
