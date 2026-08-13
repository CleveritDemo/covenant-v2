import React, { useEffect, useId, useRef, useState } from 'react'
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
  /**
   * El textarea del composer: el foco de DOM nunca se mueve a la lista (así
   * el cursor sigue visible), así que la fila activa se anuncia vía
   * `aria-activedescendant` sobre ESTE elemento, y el listener global de
   * teclado se ignora si el foco real está en otro lado (otro pane, un
   * modal): sin este chequeo, un Enter en cualquier parte de la app elegía
   * la fila activa de una mención abierta en un composer que ni se ve.
   */
  focusElement: HTMLElement | null
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
  focusElement,
}) => {
  const { t } = useT()
  const [results, setResults] = useState<JiraIssueRef[]>([])
  const [active, setActive] = useState(0)
  // El orden de respuesta no está garantizado: solo la última búsqueda pinta.
  const requestRef = useRef(0)
  const listId = useId()
  const optionId = (index: number): string => `${listId}-option-${index}`

  useEffect(() => {
    const token = ++requestRef.current
    const timer = setTimeout(() => {
      void window.api.jiraSearch(cwd, query).then((issues: JiraIssueRef[]) => {
        if (token !== requestRef.current) return
        setResults(issues)
        setActive(0)
      }).catch(() => {
        // Canal caído a mitad de vuelo: no dejar resultados viejos pintados.
        if (token !== requestRef.current) return
        setResults([])
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [cwd, query])

  /**
   * Escucha en fase de *captura*: así corre antes que el `onKeyDown`
   * sintético del textarea (React delega ese en fase de burbuja, más abajo
   * en el árbol que `window`). Con eso el picker decide primero — y solo si
   * hay resultados llama `stopPropagation()` para que el composer no envíe
   * el turno ni mueva el historial con la misma tecla. Sin resultados no
   * hace nada: ninguna tecla se traga (Enter llega intacto al composer).
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!results.length) return
      if (focusElement && document.activeElement !== focusElement) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setActive(current => Math.min(current + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setActive(current => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onPick(results[active])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [results, active, onPick, onDismiss, focusElement])

  // Anuncia la fila activa sobre el textarea (el foco real nunca se mueve).
  useEffect(() => {
    if (!focusElement) return
    if (!results.length) {
      focusElement.removeAttribute('aria-expanded')
      focusElement.removeAttribute('aria-activedescendant')
      return
    }
    focusElement.setAttribute('aria-expanded', 'true')
    focusElement.setAttribute('aria-controls', listId)
    focusElement.setAttribute('aria-activedescendant', optionId(active))
    return () => {
      focusElement.removeAttribute('aria-expanded')
      focusElement.removeAttribute('aria-activedescendant')
    }
  }, [focusElement, results, active, listId])

  if (!results.length) return null

  return (
    <ul
      id={listId}
      className="jira-mention__list"
      role="listbox"
      aria-label={t('jira.mentionListLabel')}
    >
      {results.map((issue, index) => (
        <li key={issue.key} role="presentation">
          <button
            id={optionId(index)}
            type="button"
            role="option"
            aria-selected={index === active}
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
