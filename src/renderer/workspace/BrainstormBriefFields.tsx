import React from 'react'
import {
  BRAINSTORM_MAX_ROUNDS_CAP,
  BRAINSTORM_OUTCOMES,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { SegmentedControl, Select, TextArea } from '../components/ui'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
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
}) => {
  const { t } = useT()

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
      <label className="brainstorm-brief__field">
        <span className="brainstorm-brief__label">{t('tabs.brainstormRoundsLabel')}</span>
        <Select
          size="sm"
          value={String(maxRounds)}
          onChange={next => onMaxRoundsChange(sanitizeBrainstormMaxRounds(Number(next)))}
          options={roundOptions}
        />
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
