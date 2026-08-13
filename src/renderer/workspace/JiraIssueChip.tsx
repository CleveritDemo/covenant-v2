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
  onOpen,
}) => {
  const { t } = useT()
  const staleHint = t('jira.staleHint')
  return (
    <Tooltip content={summary} hint={stale ? staleHint : status}>
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
