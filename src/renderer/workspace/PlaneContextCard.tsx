import React, { useEffect, useState } from 'react'
import type { TabContextKind } from '@shared/tabContext'
import { canonicalContextFileName, canonicalContextId } from '@shared/tabContext'
import { parseJiraIssuePreview, type JiraIssuePreview } from '@shared/jiraIssueDoc'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { JiraIssueChip } from './JiraIssueChip'
import './PlaneContextCard.css'

export interface PlaneContextCardProps {
  name: string
  icon: IconName
  color: string
  shared?: boolean
  /** Fila con ícono + nombre (lista de contextos del agente). */
  showName?: boolean
  /** Clic: p. ej. abrir chat del agente. */
  onOpen?: () => void
  /** Kind real del contexto: solo `jira` cambia la representación (ver abajo). */
  kind?: TabContextKind
  /** Solo `jira`: clave de la issue. Sin ella no hay `.md` que pedir. */
  issueKey?: string
  /** Carpeta del proyecto: sin ella `previewTabContext` no puede resolver el `.md` de la issue. */
  cwd?: string
  /**
   * Se incrementa cuando los contextos del proyecto se remateralizan
   * (`refreshTabContexts` en `App.tsx`). Es la señal para releer el snapshot:
   * el chip lo pedía una sola vez al montar y se quedaba mostrando el estado
   * viejo aunque el turno acabara de refrescarlo.
   */
  contextsRevision?: number
}

/**
 * Estado inicial Y fallback de error. `stale: true` porque no saber si el
 * snapshot está lleno no es lo mismo que saber que lo está: pintarlo como
 * fresco invierte la regla del feature justo cuando falta el dato.
 */
const NO_PREVIEW: JiraIssuePreview = { stale: true }

/**
 * Resumen/estado/frescura de una issue jira, leídos del mismo `.md` que ya
 * expone `previewTabContext` — el IPC que usa cualquier preview de contexto,
 * no uno nuevo, y sin lectura de disco propia del renderer. Se pide al montar
 * y cada vez que `contextsRevision` cambia (nunca en hover, nunca en cada
 * render, nunca por polling); un fallo deja el chip sin resumen/estado en vez
 * de lanzar o quedarse cargando para siempre.
 */
function useJiraIssuePreview(
  issueKey: string | undefined,
  cwd: string | undefined,
  contextsRevision: number,
): JiraIssuePreview {
  const [preview, setPreview] = useState<JiraIssuePreview>(NO_PREVIEW)
  const key = (issueKey ?? '').trim()
  const workingCwd = (cwd ?? '').trim()

  useEffect(() => {
    if (!key || !workingCwd) return
    let cancelled = false
    const context = {
      id: canonicalContextId('jira', { issueKey: key }),
      name: key,
      fileName: canonicalContextFileName('jira', { issueKey: key }),
      kind: 'jira' as const,
      issueKey: key,
    }
    void window.api.previewTabContext({ context, cwd: workingCwd }).then(result => {
      if (cancelled) return
      setPreview(result.ok ? parseJiraIssuePreview(result.content ?? '') : NO_PREVIEW)
    }).catch(() => {
      if (!cancelled) setPreview(NO_PREVIEW)
    })
    return () => {
      cancelled = true
    }
  }, [key, workingCwd, contextsRevision])

  return preview
}

/** Contexto anidado en la mini del agente (ícono o fila con nombre). */
export const PlaneContextCard: React.FC<PlaneContextCardProps> = ({
  name,
  icon,
  color,
  shared = false,
  showName = false,
  onOpen,
  kind,
  issueKey,
  cwd,
  contextsRevision = 0,
}) => {
  const isJira = kind === 'jira' && Boolean((issueKey ?? '').trim())
  // El hook corre siempre (regla de hooks); dentro decide si hay algo que pedir.
  const preview = useJiraIssuePreview(isJira ? issueKey : undefined, cwd, contextsRevision)

  if (isJira) {
    return (
      // El botón real vive dentro de `JiraIssueChip` (contrato fijo: `onOpen`
      // sin evento) — este envoltorio replica el `stopPropagation` que el
      // ícono genérico de abajo ya hace, para no romper el drag/reorder del
      // mini del agente cuando el contexto es jira.
      <span
        className="plane-context-card__jira-wrap"
        onClick={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
      >
        <JiraIssueChip
          issueKey={(issueKey ?? '').trim()}
          summary={preview.summary ?? ''}
          status={preview.status ?? ''}
          stale={preview.stale}
          updated={preview.updated ?? ''}
          color={color}
          onOpen={() => onOpen?.()}
        />
      </span>
    )
  }

  return (
    <button
      type="button"
      className={[
        'plane-context-card',
        showName ? 'plane-context-card--labeled' : '',
        shared ? 'plane-context-card--shared' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--context-color': color } as React.CSSProperties}
      aria-label={name}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        onOpen?.()
      }}
      onPointerDown={event => event.stopPropagation()}
    >
      <Icon name={icon} size={showName ? 10 : 12} aria-hidden />
      {showName ? (
        <span className="plane-context-card__name">{name}</span>
      ) : null}
    </button>
  )
}
