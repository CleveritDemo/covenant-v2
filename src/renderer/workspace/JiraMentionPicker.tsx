import React, { useEffect, useRef, useState } from 'react'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { useT } from '@i18n/useT'
import './JiraMentionPicker.css'

const DEBOUNCE_MS = 200

export interface JiraMentionPickerProps {
  cwd: string
  /** Término vigente; el composer lo recalcula en cada tecla. */
  query: string
  onPick: (issue: JiraIssueRef) => void
  onDismiss: () => void
}

/**
 * Lista flotante de issues sobre el composer. No se pinta si no hay resultados:
 * un panel vacío tapando el texto es peor que no interrumpir.
 */
export const JiraMentionPicker: React.FC<JiraMentionPickerProps> = ({
  cwd,
  query,
  onPick,
  onDismiss,
}) => {
  const { t } = useT()
  const [results, setResults] = useState<JiraIssueRef[]>([])
  const [active, setActive] = useState(0)
  // El orden de respuesta no está garantizado: solo la última búsqueda pinta.
  const requestRef = useRef(0)

  useEffect(() => {
    const token = ++requestRef.current
    const timer = setTimeout(() => {
      void window.api.jiraSearch(cwd, query).then((issues: JiraIssueRef[]) => {
        if (token !== requestRef.current) return
        setResults(issues)
        setActive(0)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [cwd, query])

  useEffect(() => {
    if (!results.length) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive(current => Math.min(current + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive(current => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onPick(results[active])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [results, active, onPick, onDismiss])

  if (!results.length) return null

  return (
    <ul className="jira-mention__list" aria-label={t('jira.mentionListLabel')}>
      {results.map((issue, index) => (
        <li key={issue.key}>
          <button
            type="button"
            className={[
              'jira-mention__item',
              index === active ? 'jira-mention__item--active' : '',
            ].filter(Boolean).join(' ')}
            onMouseEnter={() => setActive(index)}
            onClick={() => onPick(issue)}
          >
            <span className="jira-mention__key">{issue.key}</span>
            <span className="jira-mention__summary">{issue.summary}</span>
            <span className="jira-mention__status">{issue.status}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
