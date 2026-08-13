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
  return (
    <Tooltip content={summary} hint={stale ? t('jira.staleHint') : status}>
      <button
        type="button"
        className={['jira-chip', stale ? 'jira-chip--stale' : ''].filter(Boolean).join(' ')}
        onClick={onOpen}
      >
        <Icon name="jira" size={12} />
        <span className="jira-chip__key">{issueKey}</span>
        {status ? <span className="jira-chip__status">{status}</span> : null}
      </button>
    </Tooltip>
  )
}
