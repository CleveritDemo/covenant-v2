import React, { useEffect, useMemo, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  sanitizeBrainstormInviteIds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import {
  ceremonyById,
  ceremonyUsesFreeOutcome,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
} from '@shared/agileCeremonies'
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
  /** Ceremonia elegida en el paso 1; ausente = `free`. */
  ceremony?: CeremonyId
}

/**
 * Paso 3: el brief (tema + rondas + working set) de una sala cuya ceremonia e
 * invitados ya están elegidos. La ceremonia llega hecha desde el paso 1 y aquí
 * solo se muestra: objetivo, entregables, gate y cobertura de roles.
 */
export const BrainstormRoomModal: React.FC<BrainstormRoomModalProps> = ({
  open,
  active = true,
  cwd,
  agents,
  participantAgentIds,
  onClose,
  onStarted,
  ceremony = DEFAULT_CEREMONY_ID,
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

  /** Los que ya están sentados, en orden de habla: contra ellos se casan los roles. */
  const seatedAgents = useMemo(
    () => safeSelectedIds
      .map(id => agents.find(agent => agent.id === id))
      .filter((agent): agent is ProjectAgentDefinition => Boolean(agent)),
    [safeSelectedIds, agents],
  )

  // Las rondas arrancan en las sugeridas por la ceremonia; el brief las cambia.
  useEffect(() => {
    if (!open) return
    setTopic('')
    setMaxRounds(ceremonyById(ceremony).rounds)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [open, ceremony])

  const brief = { contextIds, filePaths, outcome, ceremony }
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
      ceremony: room.ceremony,
      cwd: cwd.trim(),
    })
    onStarted(room)
  }

  const ceremonyName = ceremonyById(ceremony).name
  const title = `${t('tabs.brainstormTopicTitle')} · ${ceremonyName}`

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onClose}
      title={title}
      size="xl"
      zIndex={850}
      footer={(
        <div className="brainstorm-room-modal__footer">
          <span className="brainstorm-room-modal__step">{t('tabs.ceremonySetupBadge')}</span>
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
          {/* Con ceremonia la salida no se elige: la fija ella. */}
          <p className="brainstorm-room-modal__hint">
            {ceremonyUsesFreeOutcome(ceremony)
              ? t('tabs.brainstormTopicHint')
              : t('tabs.ceremonyBriefHint')}
          </p>
          <BrainstormBriefFields
            cwd={cwd}
            ceremony={ceremony}
            seatedAgents={seatedAgents}
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
