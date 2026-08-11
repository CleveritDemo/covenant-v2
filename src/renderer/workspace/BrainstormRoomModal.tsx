import React, { useEffect, useMemo, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  sanitizeBrainstormInviteIds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { BrainstormBriefFields } from './BrainstormBriefFields'
import { tryCreateBrainstormSession } from './brainstormUiGuards'
import './BrainstormRoomModal.css'

export interface BrainstormRoomModalProps {
  open: boolean
  active?: boolean
  cwd: string
  agents: ProjectAgentDefinition[]
  /** Invitados ya sentados en la mesa del plano, en orden de habla. */
  participantAgentIds: readonly string[]
  onClose: () => void
  onStarted: (room: BrainstormRoom) => void
}

/**
 * Modal de setup: solo tema + rondas + brief. Los invitados y su orden se
 * eligen antes, en la mesa del plano.
 */
export const BrainstormRoomModal: React.FC<BrainstormRoomModalProps> = ({
  open,
  active = true,
  cwd,
  agents,
  participantAgentIds,
  onClose,
  onStarted,
}) => {
  const { t } = useT()
  const [topic, setTopic] = useState('')
  const [maxRounds, setMaxRounds] = useState(BRAINSTORM_DEFAULT_ROUNDS)
  const [contextIds, setContextIds] = useState<string[]>([])
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')

  const safeSelectedIds = useMemo(
    () => sanitizeBrainstormInviteIds(participantAgentIds, agents),
    [participantAgentIds, agents],
  )

  useEffect(() => {
    if (!open) return
    setTopic('')
    setMaxRounds(BRAINSTORM_DEFAULT_ROUNDS)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [open])

  const brief = { contextIds, filePaths, outcome }
  const canStart = Boolean(
    tryCreateBrainstormSession(topic, safeSelectedIds, maxRounds, agents, brief),
  )

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

  const title = t('tabs.brainstormTopicTitle')

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
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('tabs.brainstormBack')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canStart}
            onClick={handleStart}
          >
            {t('tabs.brainstormStart')}
          </Button>
        </div>
      )}
    >
      {(
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
