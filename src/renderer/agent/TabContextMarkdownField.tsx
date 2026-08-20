import React, { useEffect, useMemo, useRef, useState } from 'react'
import { findTextMatches, lineIndexAt } from '@shared/textMatches'
import { useT } from '@i18n/useT'
import { TextArea } from '../components/ui'
import { TabContextSearchBar } from './TabContextSearchBar'
import './TabContextMarkdownField.css'

export interface TabContextMarkdownFieldProps {
  label: string
  hint?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

export const TabContextMarkdownField: React.FC<TabContextMarkdownFieldProps> = ({
  label,
  hint,
  placeholder,
  value,
  onChange,
}) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [navToken, setNavToken] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const matches = useMemo(() => findTextMatches(value, query), [value, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (matches.length === 0) return
    if (activeIndex >= matches.length) {
      setActiveIndex(matches.length - 1)
    }
  }, [activeIndex, matches.length])

  useEffect(() => {
    if (matches.length === 0) return
    const ta = textareaRef.current
    const match = matches[0]
    if (!ta || !match) return
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20
    ta.scrollTop = Math.max(0, (lineIndexAt(value, match.start) - 3) * lh)
  }, [query, matches, value])

  useEffect(() => {
    if (navToken === 0 || matches.length === 0) return
    const clamped = Math.min(activeIndex, matches.length - 1)
    const ta = textareaRef.current
    const match = matches[clamped]
    if (!ta || !match) return
    ta.focus()
    ta.setSelectionRange(match.start, match.end)
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20
    ta.scrollTop = Math.max(0, (lineIndexAt(value, match.start) - 3) * lh)
  }, [navToken, activeIndex, matches, value])

  const bumpNav = (): void => setNavToken(token => token + 1)

  const goPrev = (): void => {
    if (matches.length === 0) return
    if (navToken === 0) {
      bumpNav()
      return
    }
    setActiveIndex((activeIndex - 1 + matches.length) % matches.length)
    bumpNav()
  }

  const goNext = (): void => {
    if (matches.length === 0) return
    if (navToken === 0) {
      bumpNav()
      return
    }
    setActiveIndex((activeIndex + 1) % matches.length)
    bumpNav()
  }

  return (
    <div className="tab-context-markdown-field">
      <span className="tab-context-markdown-field__label">
        {label}
        {hint ? <small className="tab-context-markdown-field__hint">{hint}</small> : null}
      </span>
      <TabContextSearchBar
        value={query}
        onChange={setQuery}
        matchCount={matches.length}
        activeIndex={activeIndex}
        onPrev={goPrev}
        onNext={goNext}
        onClear={() => setQuery('')}
        ariaLabel={t('tabContexts.bodySearchAria')}
      />
      <TextArea
        ref={textareaRef}
        rows={18}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  )
}
