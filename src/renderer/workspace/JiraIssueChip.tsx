import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './JiraIssueChip.css'

export interface JiraIssueChipProps {
  issueKey: string
  /** Vacío si el `.md` todavía no trae un resumen parseable (ver `parseJiraIssuePreview`). */
  summary: string
  /** Vacío si el `.md` todavía no trae un estado parseable. */
  status: string
  /** Región `iaterminal:auto` vacía o ausente: snapshot placeholder, nunca refrescado. */
  stale: boolean
  /**
   * `fields.updated` de Jira: cuándo cambió la ISSUE. Distinto de `stale`, que
   * dice si este ARCHIVO se llegó a rellenar alguna vez. Un snapshot puede
   * estar perfecto y describir un ticket que no se toca hace dos semanas —
   * sin esta fecha, esos dos casos se veían exactamente igual. Vacío si el
   * `.md` no la trae.
   */
  updated?: string
  onOpen: () => void
}

/**
 * Chip de una issue jira dentro del pool de contextos: clave + estado visibles
 * siempre (la tarjeta accesible no depende del tooltip), resumen completo en
 * la tarjeta al pasar el cursor. `stale` se marca en vez de fingir que el
 * snapshot está al día — ver `src/shared/jiraIssueDoc.ts`.
 */
export const JiraIssueChip: React.FC<JiraIssueChipProps> = ({
  issueKey,
  summary,
  status,
  stale,
  updated = '',
  onOpen,
}) => {
  const { t } = useT()
  const staleHint = t('jira.staleHint')
  // Con snapshot lleno, el hint dice estado Y desde cuándo: son las dos cosas
  // que distinguen «al día» de «materializado pero viejo».
  const freshHint = updated.trim()
    ? `${status} · ${t('jira.updatedHint', { date: updated.trim() })}`
    : status
  return (
    <Tooltip content={summary} hint={stale ? staleHint : freshHint}>
      <button
        type="button"
        className={['jira-chip', stale ? 'jira-chip--stale' : ''].filter(Boolean).join(' ')}
        onClick={onOpen}
      >
        <Icon name="jira" size={12} aria-hidden />
        <span className="jira-chip__key">{issueKey}</span>
        {status ? <span className="jira-chip__status">{status}</span> : null}
        {/*
         * El borde punteado y el hint del Tooltip son solo un refuerzo: sin
         * esto, `stale` solo era alcanzable pasando el cursor/foco (el
         * Tooltip monta su burbuja vía `createPortal` solo si `visible`, sin
         * `aria-describedby`). Este `<span>` queda "visible" para el cálculo
         * del nombre accesible del botón (no usa `display:none` ni
         * `visibility:hidden`), así que un lector de pantalla lo anuncia
         * aunque nunca dispare el hover.
         */}
        {stale ? <span className="jira-chip__stale-label">{staleHint}</span> : null}
      </button>
    </Tooltip>
  )
}
