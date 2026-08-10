import React, { useEffect, useMemo, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_MAX_ROUNDS_CAP,
  brainstormCatalogAgentLabel,
  filterBrainstormInvitableAgents,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, ChoiceCard, Select, TextArea } from '../components/ui'
import {
  canAdvanceBrainstormInviteStep,
  tryCreateBrainstormSession,
} from './brainstormUiGuards'
import './BrainstormRoomModal.css'

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

  const invitableAgents = useMemo(
    () => filterBrainstormInvitableAgents(agents),
    [agents],
  )

  const safeSelectedIds = useMemo(
    () => sanitizeBrainstormInviteIds(selectedIds, agents),
    [selectedIds, agents],
  )

  useEffect(() => {
    if (!open) return
    setStep('invite')
    setSelectedIds([])
    setTopic('')
    setMaxRounds(BRAINSTORM_DEFAULT_ROUNDS)
  }, [open])

  useEffect(() => {
    setSelectedIds(previous => sanitizeBrainstormInviteIds(previous, agents))
  }, [agents])

  const selectedIndex = useMemo(() => {
    const map = new Map<string, number>()
    safeSelectedIds.forEach((id, index) => map.set(id, index + 1))
    return map
  }, [safeSelectedIds])

  const canNext = canAdvanceBrainstormInviteStep(safeSelectedIds, agents)
  const canStart = Boolean(
    tryCreateBrainstormSession(topic, safeSelectedIds, maxRounds, agents),
  )

  const toggleAgent = (agentId: string): void => {
    const agent = agents.find(item => item.id === agentId)
    if (!agent || !isBrainstormInvitableAgent(agent)) return
    setSelectedIds(previous => {
      const cleaned = sanitizeBrainstormInviteIds(previous, agents)
      if (cleaned.includes(agentId)) {
        return cleaned.filter(id => id !== agentId)
      }
      return [...cleaned, agentId]
    })
  }

  const handleStart = (): void => {
    const room = tryCreateBrainstormSession(
      topic,
      safeSelectedIds,
      maxRounds,
      agents,
    )
    if (!room || !cwd.trim()) return
    window.api.startBrainstorm({
      roomId: room.id,
      topic: room.topic,
      participantAgentIds: room.participantAgentIds,
      maxRounds: room.maxRounds,
      cwd: cwd.trim(),
    })
    onStarted(room)
  }

  const roundOptions = Array.from(
    { length: BRAINSTORM_MAX_ROUNDS_CAP },
    (_, index) => index + 1,
  )

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
          {invitableAgents.length === 0 ? (
            <p className="brainstorm-room-modal__hint">{t('tabs.brainstormEmptyCatalog')}</p>
          ) : (
            <div className="brainstorm-room-modal__list" role="list">
              {invitableAgents.map(agent => {
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
                        {brainstormCatalogAgentLabel(agent)}
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
        <>
          <p className="brainstorm-room-modal__hint">{t('tabs.brainstormTopicHint')}</p>
          <label className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">{t('tabs.brainstormTopicLabel')}</span>
            <TextArea
              value={topic}
              autoFocus
              rows={4}
              placeholder={t('tabs.brainstormTopicPlaceholder')}
              onChange={event => setTopic(event.target.value)}
            />
          </label>
          <label className="brainstorm-room-modal__field">
            <span className="brainstorm-room-modal__label">{t('tabs.brainstormRoundsLabel')}</span>
            <Select
              size="sm"
              value={String(maxRounds)}
              onChange={next => {
                setMaxRounds(sanitizeBrainstormMaxRounds(Number(next)))
              }}
              options={roundOptions.map(value => ({ value: String(value), label: String(value) }))}
            />
          </label>
        </>
      )}
    </TerminalModal>
  )
}
