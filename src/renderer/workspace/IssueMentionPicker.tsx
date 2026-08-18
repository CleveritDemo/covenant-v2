import React, { useEffect, useId, useState } from 'react'
import type { IssueMentionRow } from '@shared/issueMention'
import { highlightParts } from '@shared/textHighlight'
import { relativeTimeFromIso } from '@shared/relativeTime'
import { useT } from '@i18n/useT'
import { IssueSourceBadge } from '../components/ui/IssueSourceBadge'
import './IssueMentionPicker.css'

export interface IssueMentionPickerProps {
  rows: IssueMentionRow[]
  searching: boolean
  error: string
  /** Término vigente; el hook lo recalcula en cada tecla. */
  query: string
  onPick: (row: IssueMentionRow) => void
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
export const IssueMentionPicker: React.FC<IssueMentionPickerProps> = ({
  rows,
  searching,
  error,
  query,
  onPick,
  onDismiss,
  focusElement,
  placement = 'up',
  showEmptyState = false,
}) => {
  const { t } = useT()
  const [active, setActive] = useState(0)
  const listId = useId()
  const optionId = (index: number): string => `${listId}-option-${index}`

  useEffect(() => {
    setActive(0)
  }, [rows])

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
      if (!rows.length) return
      if (focusElement && document.activeElement !== focusElement) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setActive(current => Math.min(current + 1, rows.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setActive(current => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onPick(rows[active])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [rows, active, onPick, onDismiss, focusElement])

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
    if (!rows.length) {
      clear()
      return
    }
    focusElement.setAttribute('aria-expanded', 'true')
    focusElement.setAttribute('aria-controls', listId)
    focusElement.setAttribute('aria-activedescendant', optionId(active))
    return clear
  }, [focusElement, rows, active, listId])

  // Un único `now` por render: dos filas no pueden decir horas distintas.
  const now = Date.now()
  /** El trozo que coincide con lo tecleado, en negrita. */
  const marked = (text: string): React.ReactNode =>
    highlightParts(text, query).map((part, index) => (
      part.match
        ? <mark key={index} className="issue-mention__match">{part.text}</mark>
        : <span key={index}>{part.text}</span>
    ))

  if (!rows.length) {
    if (!showEmptyState) return null
    const message = error
      ? error
      : searching
        ? t('issueMention.searching')
        : t('issueMention.noMatches')
    return (
      <p
        className={[
          'issue-mention__empty',
          `issue-mention__empty--${placement}`,
          error ? 'issue-mention__empty--error' : '',
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
      className={`issue-mention__list issue-mention__list--${placement}`}
      role="listbox"
      aria-label={t('issueMention.listLabel')}
    >
      {rows.map((row, index) => (
        <li key={row.id} role="presentation">
          <button
            id={optionId(index)}
            type="button"
            role="option"
            aria-selected={index === active}
            className={[
              'issue-mention__item',
              index === active ? 'issue-mention__item--active' : '',
            ].filter(Boolean).join(' ')}
            onMouseEnter={() => setActive(index)}
            onClick={() => onPick(row)}
          >
            <span className="issue-mention__line">
              <IssueSourceBadge source={row.source} />
              <span className="issue-mention__key">{marked(row.label)}</span>
              <span className="issue-mention__summary">{marked(row.title)}</span>
              {/* La actividad reciente es lo que distingue entre varias que casan. */}
              {relativeTimeFromIso(row.updated, now)
                ? <span className="issue-mention__when">{relativeTimeFromIso(row.updated, now)}</span>
                : null}
            </span>
            <span className="issue-mention__meta">
              {row.meta.join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
