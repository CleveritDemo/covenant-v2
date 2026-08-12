import React from 'react'
import {
  BRAINSTORM_MAX_ROUNDS_CAP,
  BRAINSTORM_OUTCOMES,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
} from '@shared/brainstormRoom'
import {
  ceremonyById,
  ceremonyRoleCoverage,
  ceremonyUsesFreeOutcome,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
  type CeremonyRoleCandidate,
} from '@shared/agileCeremonies'
import { useT } from '@i18n/useT'
import { SegmentedControl, Select, TextArea } from '../components/ui'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import { CEREMONY_GOAL_KEY, CEREMONY_ROLE_KEY, ceremonyGateKey } from './ceremonyLabels'
import './BrainstormBriefFields.css'

/** Minutos estimados por turno; sirve para dimensionar la tirada, no para prometer. */
const MINUTES_PER_TURN = 0.4

export interface BrainstormBriefFieldsProps {
  cwd: string
  topic: string
  onTopicChange: (value: string) => void
  contextIds: string[]
  filePaths: string[]
  onWorkingSetChange: (next: { contextIds: string[]; filePaths: string[] }) => void
  outcome: BrainstormOutcome
  onOutcomeChange: (value: BrainstormOutcome) => void
  maxRounds: number
  onMaxRoundsChange: (value: number) => void
  /** Cuántos hablan: dimensiona el resumen de la tirada. */
  participantCount: number
  autoFocus?: boolean
  /** Ceremonia de la sala; ausente = `free` y el brief se comporta como antes. */
  ceremony?: CeremonyId
  /** Agentes ya sentados, para la cobertura de roles de la ceremonia. */
  seatedAgents?: readonly CeremonyRoleCandidate[]
}

/**
 * El brief de una sala: tema + working set + resultado + rondas.
 * Uno solo para crear y para editar — si divergen, editar deja de significar
 * lo mismo que crear, que es justo el bug que esto cierra.
 */
export const BrainstormBriefFields: React.FC<BrainstormBriefFieldsProps> = ({
  cwd,
  topic,
  onTopicChange,
  contextIds,
  filePaths,
  onWorkingSetChange,
  outcome,
  onOutcomeChange,
  maxRounds,
  onMaxRoundsChange,
  participantCount,
  autoFocus = false,
  ceremony = DEFAULT_CEREMONY_ID,
  seatedAgents = [],
}) => {
  const { t } = useT()
  const ceremonyDef = ceremonyById(ceremony)
  const isFree = ceremonyUsesFreeOutcome(ceremony)
  const gateKey = ceremonyGateKey(ceremonyDef.id)
  const seats = ceremonyRoleCoverage(ceremony, seatedAgents)
  const covered = seats.filter(seat => seat.agentId).length

  const outcomeLabels: Record<BrainstormOutcome, string> = {
    ideas: t('tabs.brainstormOutcomeIdeas'),
    decision: t('tabs.brainstormOutcomeDecision'),
    plan: t('tabs.brainstormOutcomePlan'),
    critique: t('tabs.brainstormOutcomeCritique'),
  }

  const roundOptions = Array.from(
    { length: BRAINSTORM_MAX_ROUNDS_CAP },
    (_, index) => index + 1,
  ).map(value => {
    const meaning = value === 1
      ? t('tabs.brainstormRoundsQuick')
      : value === 3
        ? t('tabs.brainstormRoundsBalanced')
        : value >= 6
          ? t('tabs.brainstormRoundsDeep')
          : ''
    return {
      value: String(value),
      label: meaning ? `${value} — ${meaning}` : String(value),
    }
  })

  const turns = participantCount * sanitizeBrainstormMaxRounds(maxRounds)

  return (
    <>
      {isFree ? null : (
        <section className="brainstorm-brief__ceremony">
          <span className="brainstorm-brief__label">
            {t('tabs.ceremonyLabel')}
            {': '}
            {ceremonyDef.name}
          </span>
          <p className="brainstorm-brief__goal">{t(CEREMONY_GOAL_KEY[ceremonyDef.id])}</p>
          <div className="brainstorm-brief__chips" aria-label={t('tabs.ceremonyOutputLabel')}>
            {ceremonyDef.deliverables.map(item => (
              <span key={item} className="brainstorm-brief__chip">{item}</span>
            ))}
          </div>
          <span className="brainstorm-brief__hint">{t('tabs.ceremonyOutputHint')}</span>
          {gateKey ? (
            <p
              className={ceremonyDef.gate?.blocking
                ? 'brainstorm-brief__gate brainstorm-brief__gate--blocking'
                : 'brainstorm-brief__gate'}
            >
              {`${t('tabs.ceremonyGateLabel')}: ${t(gateKey)}`}
            </p>
          ) : null}
          {seats.length ? (
            <>
              <ul className="brainstorm-brief__seats">
                {seats.map(seat => {
                  const agent = seatedAgents.find(item => item.id === seat.agentId)
                  return (
                    <li
                      key={seat.role}
                      className={[
                        'brainstorm-brief__seat',
                        seat.agentId ? '' : 'brainstorm-brief__seat--missing',
                        seat.via === 'guess' ? 'brainstorm-brief__seat--guess' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="brainstorm-brief__seat-role">
                        {t(CEREMONY_ROLE_KEY[seat.role])}
                      </span>
                      <span className="brainstorm-brief__seat-agent">
                        {seat.agentId
                          ? (agent?.name?.trim() || seat.agentId)
                          : t('tabs.ceremonyRoleMissing')}
                      </span>
                      {/* Sin tag: se dedujo del texto y puede fallar. */}
                      {seat.via === 'guess' ? (
                        <span className="brainstorm-brief__seat-guess">
                          {t('tabs.ceremonyRoleGuessed')}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              <span className="brainstorm-brief__hint">
                {covered === seats.length
                  ? t('tabs.ceremonyRolesCovered', {
                      covered: String(covered),
                      total: String(seats.length),
                    })
                  : t('tabs.ceremonyRolesPartial', {
                      covered: String(covered),
                      total: String(seats.length),
                    })}
              </span>
            </>
          ) : null}
        </section>
      )}
      <label className="brainstorm-brief__field">
        <span className="brainstorm-brief__label">{t('tabs.brainstormTopicLabel')}</span>
        <TextArea
          value={topic}
          autoFocus={autoFocus}
          rows={3}
          placeholder={t('tabs.brainstormTopicPlaceholder')}
          onChange={event => onTopicChange(event.target.value)}
        />
        <span className="brainstorm-brief__hint">{t('tabs.brainstormTopicFieldHint')}</span>
      </label>
      <div className="brainstorm-brief__field">
        <span className="brainstorm-brief__label">{t('tabs.brainstormWorkingSetLabel')}</span>
        <BrainstormWorkingSetField
          cwd={cwd}
          contextIds={contextIds}
          filePaths={filePaths}
          onChange={onWorkingSetChange}
        />
        <span className="brainstorm-brief__hint">{t('tabs.brainstormWorkingSetHint')}</span>
      </div>
      {/* Con ceremonia el entregable ya está fijado: elegir «salida» a mano sobraría. */}
      {isFree ? (
        <div className="brainstorm-brief__field">
          <span className="brainstorm-brief__label">{t('tabs.brainstormOutcomeLabel')}</span>
          <SegmentedControl
            size="sm"
            label={t('tabs.brainstormOutcomeLabel')}
            value={outcome}
            onChange={onOutcomeChange}
            options={BRAINSTORM_OUTCOMES.map(value => ({
              value,
              label: outcomeLabels[value],
            }))}
          />
        </div>
      ) : null}
      <label className="brainstorm-brief__field">
        <span className="brainstorm-brief__label">{t('tabs.brainstormRoundsLabel')}</span>
        <Select
          size="sm"
          value={String(maxRounds)}
          onChange={next => onMaxRoundsChange(sanitizeBrainstormMaxRounds(Number(next)))}
          options={roundOptions}
        />
        {isFree ? null : (
          <span className="brainstorm-brief__hint">
            {t('tabs.ceremonyRoundsSuggested', { count: String(ceremonyDef.rounds) })}
          </span>
        )}
      </label>
      <p className="brainstorm-brief__summary">
        {t('tabs.brainstormRunSummary', {
          turns: String(turns),
          contexts: String(contextIds.length + filePaths.length),
          minutes: String(Math.max(1, Math.round(turns * MINUTES_PER_TURN))),
        })}
      </p>
    </>
  )
}
