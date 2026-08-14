import React from 'react'
import { useT } from '@i18n/useT'
import type { DelegationResultCardData } from '@shared/delegationResultCards'
import { AiMarkdown } from '../components/AiMarkdown'
import './DelegationResultCard.css'

/**
 * El follow-up de una delegación llega al chat del orquestador como mensaje de
 * usuario, y los mensajes de usuario se pintan literales a propósito (lo que
 * escribió una persona no se reinterpreta). Pero este no lo escribió nadie: lo
 * arma el host, y en crudo se leía como un volcado —`id:`, `status:` y una
 * tabla markdown con los pipes a la vista.
 *
 * La tarjeta se queda con lo que le sirve a quien mira: quién contestó, cómo
 * le fue, qué resumió y qué archivos tocó.
 */
export const DelegationResultCard: React.FC<{
  data: DelegationResultCardData
  agentLabel?: string
}> = ({ data, agentLabel }) => {
  const { t } = useT()
  const statusLabel = t(`delegationCard.status_${data.status}`)
  const displayAgent = agentLabel || data.agentId || t('delegationCard.agentUnknown')

  return (
    <div className={`delegation-card delegation-card--${data.status}`}>
      <div className="delegation-card__head">
        <span className="delegation-card__agent">
          {displayAgent}
        </span>
        <span className="delegation-card__status">{statusLabel}</span>
        {data.round ? (
          <span className="delegation-card__meta">{t('delegationCard.round', { round: data.round })}</span>
        ) : null}
        {data.pendingInBatch ? (
          <span className="delegation-card__meta">
            {t('delegationCard.pending', { n: data.pendingInBatch })}
          </span>
        ) : null}
      </div>

      {data.summary ? (
        <div className="delegation-card__summary">
          {/* Markdown y no texto plano: el resumen del especialista suele traer
              tablas y listas, que era justo lo que se veía en crudo. */}
          <AiMarkdown content={data.summary} />
        </div>
      ) : null}

      {data.changelog.length > 0 ? (
        <ul className="delegation-card__changelog">
          {data.changelog.map(entry => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
