import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { TerminalBufferFindMatch } from '@renderer/terminal/terminalFindInBuffer'
import './TerminalFindModal.css'

interface Props {
  open: boolean
  onClose: () => void
  bufferMatches: TerminalBufferFindMatch[]
  historyMatches: string[]
  onSearch: (query: string) => void
  onGoToBufferMatch: (m: TerminalBufferFindMatch) => void
  onApplyHistoryLine: (line: string) => void
}

function MatchLinePreview({ text, col, len }: { text: string; col: number; len: number }): React.ReactElement {
  const a = text.slice(0, col)
  const b = text.slice(col, col + len)
  const c = text.slice(col + len)
  return (
    <span className="terminal-find-preview">
      {a}
      <mark className="terminal-find-mark">{b}</mark>
      {c}
    </span>
  )
}

export const TerminalFindModal: React.FC<Props> = ({
  open,
  onClose,
  bufferMatches,
  historyMatches,
  onSearch,
  onGoToBufferMatch,
  onApplyHistoryLine,
}) => {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHasSearched(false)
    queueMicrotask(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open])

  const submit = useCallback((): void => {
    const q = query.trim()
    if (!q) return
    setHasSearched(true)
    onSearch(query)
  }, [onSearch, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.target === inputRef.current || inputRef.current?.contains(e.target as Node))) {
        e.preventDefault()
        e.stopPropagation()
        submit()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, submit])

  const total = bufferMatches.length + historyMatches.length
  const noMatchesAfterSearch = hasSearched && total === 0

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('find.title')}
      titleId="terminal-find-title"
      size="lg"
      zIndex={680}
      footer={
        <>
          <span className="terminal-find-footer-note">
            {hasSearched
              ? t('find.footerResults', { buffer: bufferMatches.length, history: historyMatches.length })
              : t('find.footerShortcut')}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('find.closeButton')}
          </Button>
        </>
      }
    >
      <p className="terminal-find-intro" id="terminal-find-desc">
        {t('find.intro')}
      </p>
      <div className="terminal-find-field">
        <label className="terminal-find-label" htmlFor="terminal-find-input">
          {t('find.fieldLabel')}
        </label>
        <div className="terminal-find-input-row">
          <Input
            ref={inputRef}
            id="terminal-find-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('find.inputPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="terminal-find-desc"
          />
          <Button variant="primary" size="sm" onClick={submit}>
            {t('find.searchButton')}
          </Button>
        </div>
      </div>
      <p className="terminal-find-hint">
        {!hasSearched ? t('find.preSearchHint') : null}
        {t('find.caseHint')}
      </p>

      {noMatchesAfterSearch && <p className="terminal-find-empty">{t('find.noMatches')}</p>}

      {bufferMatches.length > 0 && (
        <section className="terminal-find-section" aria-label={t('find.outputAriaLabel')}>
          <h3 className="terminal-find-section-title">
            {t('find.outputSectionTitle', { n: bufferMatches.length })}
          </h3>
          <div className="terminal-find-list" role="list">
            {bufferMatches.map((m, i) => (
              <button
                key={`buf-${m.lineIndex}-${m.col}-${i}`}
                type="button"
                className="terminal-find-item"
                role="listitem"
                onClick={() => onGoToBufferMatch(m)}
              >
                <span className="terminal-find-item-meta">
                  {t('find.matchMeta', { line: m.lineIndex + 1, col: m.col + 1 })}
                </span>
                <MatchLinePreview text={m.lineText} col={m.col} len={m.matchLen} />
              </button>
            ))}
          </div>
        </section>
      )}

      {historyMatches.length > 0 && (
        <section className="terminal-find-section" aria-label={t('find.historyAriaLabel')}>
          <h3 className="terminal-find-section-title">
            {t('find.historySectionTitle', { n: historyMatches.length })}
          </h3>
          <div className="terminal-find-list" role="list">
            {historyMatches.map((line, i) => (
              <button
                key={`hist-${i}-${line.slice(0, 40)}`}
                type="button"
                className="terminal-find-item"
                role="listitem"
                aria-label={t('find.historyItemTitle')}
                onClick={() => onApplyHistoryLine(line)}
              >
                <span className="terminal-find-item-meta">{t('find.historyItemMeta')}</span>
                <span className="terminal-find-preview">{line}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </TerminalModal>
  )
}
