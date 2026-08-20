import React from 'react'
import { useT } from '@i18n/useT'
import type { DelegationBriefCardData } from '@shared/delegationBriefCard'
import { AiMarkdown } from '../components/AiMarkdown'
import './DelegationBriefCard.css'

/**
 * La simétrica de `DelegationResultCard`: el encargo que entra al panel del
 * especialista. Contesta lo que la burbuja en crudo no contestaba —quién delegó,
 * en qué oleada va, con qué contextos y si corre en un worktree aislado— y pinta
 * el objetivo como markdown, que es como lo escriben los orquestadores.
 */
export const DelegationBriefCard: React.FC<{
  data: DelegationBriefCardData
  fromLabel?: string
  toLabel?: string
}> = ({ data, fromLabel, toLabel }) => {
  const { t } = useT()
  const from = fromLabel || data.fromAgentId || t('delegationBrief.agentUnknown')
  const to = toLabel || data.toAgentId
  const kind = t(data.nested ? 'delegationBrief.kindNested' : 'delegationBrief.kind')
  const hasFoot = data.contextIds.length > 0 || Boolean(data.worktree)

  return (
    <div className={`delegation-brief${data.nested ? ' delegation-brief--nested' : ''}`}>
      <div className="delegation-brief__head">
        <span className="delegation-brief__from">{from}</span>
        {to ? (
          <>
            <span className="delegation-brief__arrow" aria-hidden="true">→</span>
            <span className="delegation-brief__to">{to}</span>
          </>
        ) : null}
        <span className="delegation-brief__kind">{kind}</span>
        {data.round ? (
          <span className="delegation-brief__meta">
            {t('delegationBrief.round', { round: data.round })}
          </span>
        ) : null}
      </div>

      <div className="delegation-brief__objective">
        {data.objective
          ? <AiMarkdown content={data.objective} />
          : (
              <span className="delegation-brief__empty">
                {t('delegationBrief.emptyObjective')}
              </span>
            )}
      </div>

      {hasFoot ? (
        <div className="delegation-brief__foot">
          {data.contextIds.map(id => (
            <span key={id} className="delegation-brief__chip">{id}</span>
          ))}
          {data.worktree ? (
            <span className="delegation-brief__chip delegation-brief__chip--worktree">
              {t('delegationBrief.worktree', { name: data.worktree })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
