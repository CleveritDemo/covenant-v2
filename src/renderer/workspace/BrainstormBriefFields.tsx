import React, { useCallback, useRef } from 'react'
import {
  BRAINSTORM_OUTCOMES,
  brainstormRunMinutes,
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
import type { JiraIssueRef } from '@shared/jiraIssue'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { useJiraMention } from './useJiraMention'
import { useT } from '@i18n/useT'
import { SegmentedControl, TextArea } from '../components/ui'
import { BrainstormRoundsSlider } from './BrainstormRoundsSlider'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import { CEREMONY_GOAL_KEY, CEREMONY_ROLE_KEY, ceremonyGateKey } from './ceremonyLabels'
import './BrainstormBriefFields.css'

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
  const topicRef = useRef<HTMLTextAreaElement>(null)
  /**
   * La issue elegida entra en el working set además de escribirse en el tema:
   * la sala arranca con el ticket ya adjunto, sin pegarlo a mano.
   */
  const attachIssue = useCallback((issue: JiraIssueRef): void => {
    const context = jiraDraftFromKey(issue.key)
    if (!context || !cwd.trim()) return
    void window.api.materializeTabContext({ context, cwd }).then(result => {
      if (!result.ok) return
      onWorkingSetChange({
        contextIds: contextIds.includes(context.id) ? contextIds : [...contextIds, context.id],
        filePaths,
      })
    }).catch(() => {
      // Sin `.md` en disco no hay contexto real que sumar al working set.
    })
  }, [contextIds, cwd, filePaths, onWorkingSetChange])

  const mention = useJiraMention({
    cwd,
    value: topic,
    onValueChange: onTopicChange,
    inputRef: topicRef,
    onPicked: attachIssue,
    placement: 'down',
    showEmptyState: true,
  })
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
        {/*
          Mencionar la issue en el tema la añade además al working set: convocar
          una sala sobre un ticket y tener que pegar su contexto aparte era el
          mismo dato pedido dos veces.
        */}
        <div className="brainstorm-brief__mention-anchor">
          <TextArea
            ref={topicRef}
            value={topic}
            autoFocus={autoFocus}
            rows={3}
            placeholder={t('tabs.brainstormTopicPlaceholder')}
            onChange={event => {
              onTopicChange(event.target.value)
              mention.handleChange(event.target)
            }}
            onSelect={event => mention.handleSelect(event.currentTarget)}
          />
          {mention.picker}
        </div>
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
      <div className="brainstorm-brief__field">
        <span className="brainstorm-brief__label">{t('tabs.brainstormRoundsLabel')}</span>
        <BrainstormRoundsSlider
          value={maxRounds}
          onChange={onMaxRoundsChange}
          participantCount={participantCount}
        />
        {isFree ? null : (
          <span className="brainstorm-brief__hint">
            {t('tabs.ceremonyRoundsSuggested', { count: String(ceremonyDef.rounds) })}
          </span>
        )}
      </div>
      <p className="brainstorm-brief__summary">
        {t('tabs.brainstormRunSummary', {
          turns: String(turns),
          contexts: String(contextIds.length + filePaths.length),
          minutes: String(brainstormRunMinutes(turns)),
        })}
      </p>
    </>
  )
}
