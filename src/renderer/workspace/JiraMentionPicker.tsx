import React, { useEffect, useId, useRef, useState } from 'react'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { highlightParts } from '@shared/textHighlight'
import { relativeTimeFromIso } from '@shared/relativeTime'
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
  /**
   * Hacia dónde se despliega la lista. El composer vive pegado al borde
   * inferior de la ventana, así que abre hacia arriba (`up`, por defecto); en
   * un formulario el campo tiene sitio debajo.
   */
  placement?: 'up' | 'down'
  /**
   * Pintar «buscando…», «sin coincidencias» y los errores además de la lista.
   *
   * En el composer se deja en `false`: un panel flotando sobre lo que escribes
   * para decirte que no hay nada es peor que no interrumpir. En un formulario
   * es al revés — el silencio total parece que la app está rota, que es justo
   * lo que pasaba cuando un JQL inválido devolvía cero resultados.
   */
  showEmptyState?: boolean
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
  placement = 'up',
  showEmptyState = false,
}) => {
  const { t } = useT()
  const [results, setResults] = useState<JiraIssueRef[]>([])
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)
  // El orden de respuesta no está garantizado: solo la última búsqueda pinta.
  const requestRef = useRef(0)
  const listId = useId()
  const optionId = (index: number): string => `${listId}-option-${index}`

  useEffect(() => {
    const token = ++requestRef.current
    setSearching(true)
    const timer = setTimeout(() => {
      // Igual que en `useJiraMention`: si el puente no expone el método (preload
      // desfasado), esto debe acabar en el `.catch` y no lanzar en un timer,
      // donde nadie lo recoge y se pierde la excepción.
      void Promise.resolve().then(() => window.api.jiraSearch(cwd, query)).then(result => {
        if (token !== requestRef.current) return
        setResults(result.issues)
        setError(result.error ?? '')
        setSearching(false)
        setActive(0)
      }).catch((cause: unknown) => {
        // Canal caído a mitad de vuelo: no dejar resultados viejos pintados.
        if (token !== requestRef.current) return
        setResults([])
        setError(cause instanceof Error ? cause.message : String(cause))
        setSearching(false)
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
    // Los TRES atributos se ponen y se quitan juntos: dejar un `aria-controls`
    // apuntando a un `<ul>` que ya no está en el DOM le da al lector de
    // pantalla una referencia rota sobre el textarea del composer.
    const clear = (): void => {
      focusElement.removeAttribute('aria-expanded')
      focusElement.removeAttribute('aria-controls')
      focusElement.removeAttribute('aria-activedescendant')
    }
    if (!results.length) {
      clear()
      return
    }
    focusElement.setAttribute('aria-expanded', 'true')
    focusElement.setAttribute('aria-controls', listId)
    focusElement.setAttribute('aria-activedescendant', optionId(active))
    return clear
  }, [focusElement, results, active, listId])

  // Un único `now` por render: dos filas no pueden decir horas distintas.
  const now = Date.now()
  /** El trozo que coincide con lo tecleado, en negrita. */
  const marked = (text: string): React.ReactNode =>
    highlightParts(text, query).map((part, index) => (
      part.match
        ? <mark key={index} className="jira-mention__match">{part.text}</mark>
        : <span key={index}>{part.text}</span>
    ))

  if (!results.length) {
    if (!showEmptyState) return null
    const message = error
      ? error
      : searching
        ? t('jira.searching')
        : t('jira.noMatches')
    return (
      <p
        className={[
          'jira-mention__empty',
          `jira-mention__empty--${placement}`,
          error ? 'jira-mention__empty--error' : '',
        ].filter(Boolean).join(' ')}
        // Los errores de búsqueda son accionables (config rota, Jira caído):
        // se anuncian; «buscando…» y «sin coincidencias», no.
        role={error ? 'alert' : undefined}
      >
        {message}
      </p>
    )
  }

  return (
    <ul
      id={listId}
      className={`jira-mention__list jira-mention__list--${placement}`}
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
            <span className="jira-mention__line">
              <span className="jira-mention__key">{marked(issue.key)}</span>
              <span className="jira-mention__summary">{marked(issue.summary)}</span>
              {/* La actividad reciente es lo que distingue entre varias que casan. */}
              {relativeTimeFromIso(issue.updated, now)
                ? <span className="jira-mention__when">{relativeTimeFromIso(issue.updated, now)}</span>
                : null}
            </span>
            <span className="jira-mention__meta">
              {['Jira', issue.issueType, issue.key.split('-')[0], issue.status]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
