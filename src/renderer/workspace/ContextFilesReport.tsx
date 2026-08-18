import React, { useEffect, useRef, useState } from 'react'
import type { ContextPathSection } from '@shared/contextReportDoc'
import { useT } from '@i18n/useT'
import { Tooltip } from '../components/ui'
import './ContextFilesReport.css'

export interface ContextFilesReportProps {
  sections: ContextPathSection[]
  renderBody: (body: string) => React.ReactNode
}

function lastSegment(path: string): string {
  const segs = path.split('/').filter(Boolean)
  return segs[segs.length - 1] ?? path
}

function tabLabel(path: string, paths: readonly string[]): string {
  const base = lastSegment(path)
  const clash = paths.filter(p => lastSegment(p) === base).length > 1
  if (!clash) return base
  const segs = path.split('/').filter(Boolean)
  return segs.slice(-2).join('/') || path
}

export const ContextFilesReport: React.FC<ContextFilesReportProps> = ({
  sections,
  renderBody,
}) => {
  const { t } = useT()
  const [selected, setSelected] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pathsKey = sections.map(s => s.path).join('\0')
  const paths = sections.map(s => s.path)

  useEffect(() => {
    setSelected(0)
  }, [pathsKey])

  if (!sections.length) return null

  const index = Math.min(selected, sections.length - 1)
  const section = sections[index]

  const move = (delta: number): void => {
    const next = (index + delta + sections.length) % sections.length
    setSelected(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="context-files-report">
      <div
        className="context-files-report__tabs"
        role="tablist"
        aria-label={t('tabContexts.reportFilesTabs')}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            move(1)
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            move(-1)
          }
        }}
      >
        {sections.map((item, i) => (
          <Tooltip key={`${item.path}:${i}`} content={item.path}>
            <button
              ref={el => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.path}
              tabIndex={i === index ? 0 : -1}
              className={[
                'context-files-report__tab',
                i === index ? 'context-files-report__tab--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelected(i)}
            >
              {tabLabel(item.path, paths)}
            </button>
          </Tooltip>
        ))}
      </div>
      <p className="context-files-report__path">{section.path}</p>
      <div className="context-files-report__panel" role="tabpanel">
        {renderBody(section.body)}
      </div>
    </div>
  )
}
