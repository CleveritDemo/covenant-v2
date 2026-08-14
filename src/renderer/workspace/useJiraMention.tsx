import React, { useCallback, useEffect, useRef, useState } from 'react'
import { mentionRangeAt, type JiraIssueRef, type JiraMentionRange } from '@shared/jiraIssue'
import { JiraMentionPicker } from './JiraMentionPicker'

type MentionInput = HTMLTextAreaElement | HTMLInputElement

export interface UseJiraMentionOptions {
  /** Carpeta del proyecto: sin ella no hay `jiraStatus`/`jiraSearch` posibles. */
  cwd: string
  /** Texto actual del campo. */
  value: string
  /** Reemplazar el texto tras elegir una issue. */
  onValueChange: (next: string) => void
  /** El campo donde se escribe; hace falta para el caret y para el teclado. */
  inputRef: React.RefObject<MentionInput | null>
  /**
   * Qué más pasa al elegir, además de sustituir el token por la clave. El
   * composer materializa el contexto y lo adjunta al turno; un mensaje de
   * commit o un nombre de rama no necesitan nada de eso.
   */
  onPicked?: (issue: JiraIssueRef) => void
  placement?: 'up' | 'down'
  showEmptyState?: boolean
}

export interface JiraMention {
  /** La lista, ya posicionada. Va dentro de un contenedor `position: relative`. */
  picker: React.ReactNode
  /** Recalcula la mención tras escribir. */
  handleChange: (element: MentionInput) => void
  /** Recalcula al mover el caret (flechas, clic, Cmd+A). */
  handleSelect: (element: MentionInput) => void
  /** Hay una mención abierta: el consumidor no debe tratar Enter como envío. */
  active: boolean
  /** Cerrar sin elegir: al enviar, al cambiar de agente, al limpiar el campo. */
  close: () => void
}

/**
 * La mención de issues de Jira, reutilizable en cualquier campo de texto.
 *
 * Vivía dentro de `PlaneChatComposer`. Se extrajo al pedir la misma mención en
 * el chat de cada agente, en el mensaje de commit, en el nombre de rama y en el
 * brief de un brainstorm: cinco copias de la detección, el debounce y el
 * teclado habrían divergido a la primera corrección.
 *
 * El hook se ocupa del texto y de la lista; lo que pase *además* al elegir lo
 * decide cada consumidor con `onPicked`.
 */
export function useJiraMention({
  cwd,
  value,
  onValueChange,
  inputRef,
  onPicked,
  placement = 'up',
  showEmptyState = false,
}: UseJiraMentionOptions): JiraMention {
  /** Claves de proyecto conectadas: sin esto ningún token abre nada. */
  const [projectKeys, setProjectKeys] = useState<string[]>([])
  const [range, setRange] = useState<JiraMentionRange | null>(null)
  // Se lee por ref y no como dependencia: así `pick` es estable y el picker no
  // reinstala su listener de teclado en cada tecla.
  const rangeRef = useRef(range)
  rangeRef.current = range
  // El elemento como estado además de la ref: el picker necesita re-render
  // cuando existe para colgarle el `aria-activedescendant`, y una ref no lo dispara.
  const [inputEl, setInputEl] = useState<MentionInput | null>(null)

  useEffect(() => {
    setInputEl(inputRef.current)
  })

  useEffect(() => {
    if (!cwd.trim()) {
      setProjectKeys([])
      return
    }
    let cancelled = false
    /*
     * `Promise.resolve().then(...)` y no una llamada directa: si el puente no
     * expone `jiraStatus` —un preload más viejo que el renderer, que en dev
     * pasa cada vez que se toca el preload— la llamada directa lanza dentro
     * del efecto y **tumba el componente que hospeda el campo**. La mención es
     * un extra: cuando no se puede consultar, se queda apagada y ya.
     */
    void Promise.resolve()
      .then(() => window.api.jiraStatus(cwd))
      .then(status => {
        if (!cancelled) setProjectKeys(status.connected ? status.projectKeys : [])
      })
      .catch(() => {
        if (!cancelled) setProjectKeys([])
      })
    return () => { cancelled = true }
  }, [cwd])

  const recompute = useCallback((element: MentionInput): void => {
    setRange(mentionRangeAt(
      element.value,
      element.selectionStart ?? element.value.length,
      projectKeys,
    ))
  }, [projectKeys])

  /**
   * Sustituye el token escrito (`GRAV-4`, `@algo`) por la clave canónica. Sin
   * esto el texto se queda truncado mientras lo adjuntado apunta a otra cosa, y
   * el token superviviente reabre la lista en la siguiente tecla.
   */
  const pick = useCallback((issue: JiraIssueRef): void => {
    const current = rangeRef.current
    setRange(null)
    if (current) {
      const insert = `${issue.key} `
      onValueChange(`${value.slice(0, current.start)}${insert}${value.slice(current.end)}`)
      const element = inputRef.current
      if (element) {
        const caretAt = current.start + insert.length
        requestAnimationFrame(() => {
          element.focus()
          element.setSelectionRange(caretAt, caretAt)
        })
      }
    }
    onPicked?.(issue)
  }, [inputRef, onPicked, onValueChange, value])

  const dismiss = useCallback(() => setRange(null), [])

  return {
    active: range !== null,
    close: dismiss,
    handleChange: recompute,
    handleSelect: recompute,
    picker: range !== null && cwd.trim()
      ? (
        <JiraMentionPicker
          cwd={cwd}
          query={range.query}
          placement={placement}
          showEmptyState={showEmptyState}
          focusElement={inputEl}
          onPick={pick}
          onDismiss={dismiss}
        />
      )
      : null,
  }
}
