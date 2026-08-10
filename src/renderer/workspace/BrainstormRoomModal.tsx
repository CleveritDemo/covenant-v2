import React, { useEffect, useMemo, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_MAX_ROUNDS_CAP,
  BRAINSTORM_OUTCOMES,
  brainstormTurnCount,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, ChoiceCard, SegmentedControl, Select, TextArea } from '../components/ui'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import {
  canAdvanceBrainstormInviteStep,
  tryCreateBrainstormSession,
} from './brainstormUiGuards'
import './BrainstormRoomModal.css'

/** Minutos estimados por turno; sirve para dimensionar la tirada, no para prometer. */
const MINUTES_PER_TURN = 0.4

export type BrainstormModalStep = 'invite' | 'topic'

export interface BrainstormRoomModalProps {
  open: boolean
  active?: boolean
  cwd: string
  agents: ProjectAgentDefinition[]
  onClose: () => void
  onStarted: (room: BrainstormRoom) => void
}

/** Modal de setup: invitados (orden = habla) → tema + rondas → startBrainstorm. */
export const BrainstormRoomModal: React.FC<BrainstormRoomModalProps> = ({
  open,
  active = true,
  cwd,
  agents,
  onClose,
  onStarted,
}) => {
  const { t } = useT()
  const [step, setStep] = useState<BrainstormModalStep>('invite')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [maxRounds, setMaxRounds] = useState(BRAINSTORM_DEFAULT_ROUNDS)
  const [contextIds, setContextIds] = useState<string[]>([])
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')

  useEffect(() => {
    if (!open) return
    setStep('invite')
    setSelectedIds([])
    setTopic('')
    setMaxRounds(BRAINSTORM_DEFAULT_ROUNDS)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [open])

  const selectedIndex = useMemo(() => {
    const map = new Map<string, number>()
    selectedIds.forEach((id, index) => map.set(id, index + 1))
    return map
  }, [selectedIds])

  const outcomeLabels: Record<BrainstormOutcome, string> = {
    ideas: t('tabs.brainstormOutcomeIdeas'),
    decision: t('tabs.brainstormOutcomeDecision'),
    plan: t('tabs.brainstormOutcomePlan'),
    critique: t('tabs.brainstormOutcomeCritique'),
  }

  const brief = { contextIds, filePaths, outcome }
  const canNext = canAdvanceBrainstormInviteStep(selectedIds)
  const canStart = Boolean(tryCreateBrainstormSession(topic, selectedIds, maxRounds, brief))
  const turns = brainstormTurnCount({ participantAgentIds: selectedIds, maxRounds })

  const toggleAgent = (agentId: string): void => {
    setSelectedIds(previous => {
      if (previous.includes(agentId)) {
        return previous.filter(id => id !== agentId)
      }
      return [...previous, agentId]
    })
  }

  const handleStart = (): void => {
    const room = tryCreateBrainstormSession(topic, selectedIds, maxRounds, brief)
    if (!room || !cwd.trim()) return
    window.api.startBrainstorm({
      roomId: room.id,
      topic: room.topic,
      participantAgentIds: room.participantAgentIds,
      maxRounds: room.maxRounds,
      contextIds: room.contextIds,
      filePaths: room.filePaths,
      outcome: room.outcome,
      cwd: cwd.trim(),
    })
    onStarted(room)
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

  const title = step === 'invite'
    ? t('tabs.brainstormInviteTitle')
    : t('tabs.brainstormTopicTitle')

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onClose}
      title={title}
      size="md"
      zIndex={850}
      footer={(
        <div className="brainstorm-room-modal__footer">
          {step === 'topic' ? (
            <Button variant="secondary" size="sm" onClick={() => setStep('invite')}>
              {t('tabs.brainstormBack')}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          )}
          {step === 'invite' ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!canNext}
              onClick={() => setStep('topic')}
            >
              {t('tabs.brainstormNext')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={!canStart}
              onClick={handleStart}
            >
              {t('tabs.brainstormStart')}
            </Button>
          )}
        </div>
      )}
    >
      {step === 'invite' ? (
        <>
          <p className="brainstorm-room-modal__hint">{t('tabs.brainstormInviteHint')}</p>
          {agents.length === 0 ? (
            <p className="brainstorm-room-modal__hint">{t('tabs.brainstormEmptyCatalog')}</p>
          ) : (
            <div className="brainstorm-room-modal__list" role="list">
              {agents.map(agent => {
                const selected = selectedIndex.has(agent.id)
                const role = agent.role?.trim()
                return (
                  <ChoiceCard
                    key={agent.id}
                    role="listitem"
                    selected={selected}
                    aria-checked={selected}
                    onClick={() => toggleAgent(agent.id)}
                  >
                    <span className="brainstorm-room-modal__agent-row">
                      <span className="brainstorm-room-modal__agent-name">
                        {agent.name?.trim() || agent.id}
                      </span>
                      {role ? (
                        <span className="brainstorm-room-modal__agent-role">{role}</span>
                      ) : null}
                    </span>
                  </ChoiceCard>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canStart) {
              event.preventDefault()
              handleStart()
            }
          }}
        >
          <p className="brainstorm-room-modal__hint">{t('tabs.brainstormTopicHint')}</p>
          <label className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">{t('tabs.brainstormTopicLabel')}</span>
            <TextArea
              value={topic}
              autoFocus
              rows={3}
              placeholder={t('tabs.brainstormTopicPlaceholder')}
              onChange={event => setTopic(event.target.value)}
            />
            <span className="brainstorm-room-modal__hint">
              {t('tabs.brainstormTopicFieldHint')}
            </span>
          </label>
          <div className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">
              {t('tabs.brainstormWorkingSetLabel')}
            </span>
            <BrainstormWorkingSetField
              cwd={cwd}
              contextIds={contextIds}
              filePaths={filePaths}
              onChange={next => {
                setContextIds(next.contextIds)
                setFilePaths(next.filePaths)
              }}
            />
            <span className="brainstorm-room-modal__hint">
              {t('tabs.brainstormWorkingSetHint')}
            </span>
          </div>
          <div className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">
              {t('tabs.brainstormOutcomeLabel')}
            </span>
            <SegmentedControl
              size="sm"
              label={t('tabs.brainstormOutcomeLabel')}
              value={outcome}
              onChange={setOutcome}
              options={BRAINSTORM_OUTCOMES.map(value => ({
                value,
                label: outcomeLabels[value],
              }))}
            />
          </div>
          <label className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">{t('tabs.brainstormRoundsLabel')}</span>
            <Select
              size="sm"
              value={String(maxRounds)}
              onChange={next => {
                setMaxRounds(sanitizeBrainstormMaxRounds(Number(next)))
              }}
              options={roundOptions}
            />
          </label>
          <p className="brainstorm-room-modal__summary">
            {t('tabs.brainstormRunSummary', {
              turns: String(turns),
              contexts: String(contextIds.length + filePaths.length),
              minutes: String(Math.max(1, Math.round(turns * MINUTES_PER_TURN))),
            })}
          </p>
        </div>
      )}
    </TerminalModal>
  )
}
