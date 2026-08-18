import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  githubRowFromIssue,
  issueMentionRangeAt,
  jiraRowFromIssue,
  selectIssueMentionSources,
  type IssueMentionPicked,
  type IssueMentionRange,
  type IssueMentionRow,
  type IssueMentionSourceId,
} from '@shared/issueMention'
import { IssueMentionPicker } from './IssueMentionPicker'

type MentionInput = HTMLTextAreaElement | HTMLInputElement

const DEBOUNCE_MS = 200

export interface UseIssueMentionOptions {
  /** Carpeta del proyecto: sin ella no hay `jiraStatus`/`jiraSearch` posibles. */
  cwd: string
  /** Texto actual del campo. */
  value: string
  /** Reemplazar el texto tras elegir una issue. */
  onValueChange: (next: string) => void
  /** El campo donde se escribe; hace falta para el caret y para el teclado. */
  inputRef: React.RefObject<MentionInput | null>
  /**
   * Qué más pasa al elegir, además de sustituir el token por la etiqueta. El
   * composer materializa el contexto y lo adjunta al turno; un mensaje de
   * commit o un nombre de rama no necesitan nada de eso.
   */
  onPicked?: (picked: IssueMentionPicked) => void
  placement?: 'up' | 'down'
  showEmptyState?: boolean
}

export interface IssueMention {
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

type IssueMentionSourceResult = {
  rows: IssueMentionRow[]
  error: string
  picked: IssueMentionPicked[]
}

type IssueMentionSource = {
  id: IssueMentionSourceId
  search: (cwd: string, query: string) => Promise<IssueMentionSourceResult>
}

export type IssueMentionConnected = { jira: boolean; github: boolean }

/**
 * Fuentes de la mención `#`. Sumar un origen es agregar una entrada.
 */
const ISSUE_MENTION_SOURCES: IssueMentionSource[] = [
  {
    id: 'jira',
    search: (cwd, query) =>
      Promise.resolve()
        .then(() => window.api.jiraSearch(cwd, query))
        .then(result => ({
          rows: result.issues.map(jiraRowFromIssue),
          error: result.error ?? '',
          picked: result.issues.map((issue): IssueMentionPicked => ({ source: 'jira', issue })),
        })),
  },
  {
    id: 'github',
    search: (cwd, query) =>
      Promise.resolve()
        .then(() => window.api.githubIssueSearch(cwd, query))
        .then(result => ({
          rows: result.issues.map(githubRowFromIssue),
          error: result.error ?? '',
          picked: result.issues.map((issue): IssueMentionPicked => ({ source: 'github', issue })),
        })),
  },
]

function pickedId(picked: IssueMentionPicked): string {
  return picked.source === 'jira'
    ? jiraRowFromIssue(picked.issue).id
    : githubRowFromIssue(picked.issue).id
}

async function searchIssueMentionSources(
  cwd: string,
  query: string,
  connected: IssueMentionConnected,
): Promise<IssueMentionSourceResult> {
  const active = new Set(selectIssueMentionSources(query, connected))
  const results = await Promise.all(
    ISSUE_MENTION_SOURCES.filter(source => active.has(source.id)).map(source => source.search(cwd, query)),
  )
  return {
    rows: results.flatMap(result => result.rows),
    error: results.find(result => result.error)?.error ?? '',
    picked: results.flatMap(result => result.picked),
  }
}

export function useIssueMentionSearch(
  cwd: string,
  query: string,
  enabled: boolean,
  connected: IssueMentionConnected = { jira: true, github: false },
): {
  rows: IssueMentionRow[]
  searching: boolean
  error: string
  pickedById: Map<string, IssueMentionPicked>
} {
  const [rows, setRows] = useState<IssueMentionRow[]>([])
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const requestRef = useRef(0)
  const pickedByIdRef = useRef(new Map<string, IssueMentionPicked>())

  useEffect(() => {
    if (!enabled || !cwd.trim()) {
      setRows([])
      setError('')
      setSearching(false)
      pickedByIdRef.current = new Map()
      return
    }
    const token = ++requestRef.current
    setSearching(true)
    const timer = setTimeout(() => {
      // Si el puente no expone el método (preload desfasado), esto debe acabar
      // en el `.catch` y no lanzar en un timer, donde nadie lo recoge.
      void searchIssueMentionSources(cwd, query, connected).then(result => {
        if (token !== requestRef.current) return
        const next = new Map<string, IssueMentionPicked>()
        for (const item of result.picked) next.set(pickedId(item), item)
        pickedByIdRef.current = next
        setRows(result.rows)
        setError(result.error)
        setSearching(false)
      }).catch((cause: unknown) => {
        if (token !== requestRef.current) return
        pickedByIdRef.current = new Map()
        setRows([])
        setError(cause instanceof Error ? cause.message : String(cause))
        setSearching(false)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [cwd, query, enabled, connected.jira, connected.github])

  return { rows, searching, error, pickedById: pickedByIdRef.current }
}

/**
 * La mención de issues, reutilizable en cualquier campo de texto.
 *
 * Vivía dentro de `PlaneChatComposer`. Se extrajo al pedir la misma mención en
 * el chat de cada agente, en el mensaje de commit, en el nombre de rama y en el
 * brief de un brainstorm: cinco copias de la detección, el debounce y el
 * teclado habrían divergido a la primera corrección.
 *
 * El hook se ocupa del texto y de la lista; lo que pase *además* al elegir lo
 * decide cada consumidor con `onPicked`.
 */
export function useIssueMention({
  cwd,
  value,
  onValueChange,
  inputRef,
  onPicked,
  placement = 'up',
  showEmptyState = false,
}: UseIssueMentionOptions): IssueMention {
  /** Jira projectKeys: una de las dos señales que abren el sigilo `#`. */
  const [projectKeys, setProjectKeys] = useState<string[]>([])
  const [githubConnected, setGithubConnected] = useState(false)
  const [range, setRange] = useState<IssueMentionRange | null>(null)
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
      setGithubConnected(false)
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
    void Promise.resolve()
      .then(() => window.api.githubIssueStatus(cwd))
      .then(status => {
        if (!cancelled) setGithubConnected(Boolean(status.connected))
      })
      .catch(() => {
        if (!cancelled) setGithubConnected(false)
      })
    return () => { cancelled = true }
  }, [cwd])

  const mentionEnabled = projectKeys.length > 0 || githubConnected
  const connected: IssueMentionConnected = {
    jira: projectKeys.length > 0,
    github: githubConnected,
  }
  const searchEnabled = range !== null && Boolean(cwd.trim())
  const search = useIssueMentionSearch(cwd, range?.query ?? '', searchEnabled, connected)
  const pickedByIdRef = useRef(search.pickedById)
  pickedByIdRef.current = search.pickedById

  const recompute = useCallback((element: MentionInput): void => {
    setRange(issueMentionRangeAt(
      element.value,
      element.selectionStart ?? element.value.length,
      mentionEnabled,
    ))
  }, [mentionEnabled])

  /**
   * Sustituye el token escrito (`#GRAV-4`) por la etiqueta canónica. Sin
   * esto el texto se queda truncado mientras lo adjuntado apunta a otra cosa, y
   * el token superviviente reabre la lista en la siguiente tecla.
   */
  const pick = useCallback((row: IssueMentionRow): void => {
    const current = rangeRef.current
    setRange(null)
    if (current) {
      const insert = `${row.label} `
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
    const picked = pickedByIdRef.current.get(row.id)
    if (picked) onPicked?.(picked)
  }, [inputRef, onPicked, onValueChange, value])

  const dismiss = useCallback(() => setRange(null), [])

  return {
    active: range !== null,
    close: dismiss,
    handleChange: recompute,
    handleSelect: recompute,
    picker: range !== null && cwd.trim()
      ? (
        <IssueMentionPicker
          rows={search.rows}
          searching={search.searching}
          error={search.error}
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
