import React, { useEffect, useMemo, useRef, useState } from 'react'
import { findTextMatches } from '@shared/textMatches'
import { useT } from '@i18n/useT'
import { TabContextSearchBar } from './TabContextSearchBar'
import './TabContextSourceView.css'

export interface TabContextSourceViewProps {
  content: string
}

function highlightedSegments(
  content: string,
  matches: ReturnType<typeof findTextMatches>,
  activeIndex: number,
  activeRef: React.RefObject<HTMLElement>,
): React.ReactNode[] {
  if (matches.length === 0) return [content]

  const nodes: React.ReactNode[] = []
  let lastEnd = 0
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (match.start > lastEnd) {
      nodes.push(content.slice(lastEnd, match.start))
    }
    nodes.push(
      <mark
        key={`${match.start}-${match.end}`}
        ref={i === activeIndex ? activeRef : undefined}
        className={i === activeIndex ? 'tab-context-source-view__mark--active' : undefined}
      >
        {content.slice(match.start, match.end)}
      </mark>,
    )
    lastEnd = match.end
  }
  if (lastEnd < content.length) {
    nodes.push(content.slice(lastEnd))
  }
  return nodes
}

export const TabContextSourceView: React.FC<TabContextSourceViewProps> = ({ content }) => {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [navToken, setNavToken] = useState(0)
  const preRef = useRef<HTMLPreElement>(null)
  const activeMarkRef = useRef<HTMLElement>(null)

  const matches = useMemo(() => findTextMatches(content, query), [content, query])

  useEffect(() => {
    setActiveIndex(0)
    setNavToken(token => token + 1)
  }, [query])

  useEffect(() => {
    if (matches.length === 0) return
    if (activeIndex >= matches.length) {
      setActiveIndex(matches.length - 1)
    }
  }, [activeIndex, matches.length])

  useEffect(() => {
    if (navToken === 0 || matches.length === 0) return
    const markEl = activeMarkRef.current
    const pre = preRef.current
    if (!markEl || !pre) return
    pre.scrollTop = markEl.offsetTop - 40
  }, [navToken, activeIndex, matches.length, content])

  const goPrev = (): void => {
    if (matches.length === 0) return
    setActiveIndex((activeIndex - 1 + matches.length) % matches.length)
    setNavToken(token => token + 1)
  }

  const goNext = (): void => {
    if (matches.length === 0) return
    setActiveIndex((activeIndex + 1) % matches.length)
    setNavToken(token => token + 1)
  }

  return (
    <div className="tab-context-source-view">
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
      <pre ref={preRef} className="tab-context-source-view__pre">
        {highlightedSegments(content, matches, activeIndex, activeMarkRef)}
      </pre>
    </div>
  )
}
