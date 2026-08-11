import React, { useEffect, useMemo, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { BrainstormBriefFields } from './BrainstormBriefFields'
import { BrainstormInviteGrid } from './BrainstormInviteGrid'
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
  const [contextIds, setContextIds] = useState<string[]>([])
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')

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
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [open])

  useEffect(() => {
    setSelectedIds(previous => sanitizeBrainstormInviteIds(previous, agents))
  }, [agents])

  const brief = { contextIds, filePaths, outcome }
  const canNext = canAdvanceBrainstormInviteStep(safeSelectedIds, agents)
  const canStart = Boolean(
    tryCreateBrainstormSession(topic, safeSelectedIds, maxRounds, agents, brief),
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
      brief,
    )
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
          <BrainstormInviteGrid
            agents={agents}
            selectedIds={safeSelectedIds}
            onToggle={toggleAgent}
          />
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
          <BrainstormBriefFields
            cwd={cwd}
            topic={topic}
            onTopicChange={setTopic}
            contextIds={contextIds}
            filePaths={filePaths}
            onWorkingSetChange={next => {
              setContextIds(next.contextIds)
              setFilePaths(next.filePaths)
            }}
            outcome={outcome}
            onOutcomeChange={setOutcome}
            maxRounds={maxRounds}
            onMaxRoundsChange={setMaxRounds}
            participantCount={safeSelectedIds.length}
            autoFocus
          />
        </div>
      )}
    </TerminalModal>
  )
}
