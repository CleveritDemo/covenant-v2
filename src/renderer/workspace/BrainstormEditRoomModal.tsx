import React, { useEffect, useMemo, useState } from 'react'
import type { BrainstormOutcome, BrainstormRoom } from '@shared/brainstormRoom'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  sanitizeBrainstormOutcome,
  sanitizeBrainstormWorkingSet,
} from '@shared/brainstormRoom'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { BrainstormBriefFields } from './BrainstormBriefFields'
import { BrainstormInviteGrid } from './BrainstormInviteGrid'
import './BrainstormEditRoomModal.css'

export interface BrainstormEditRoomModalProps {
  open: boolean
  active?: boolean
  cwd: string
  room: BrainstormRoom | null
  /** Catálogo del proyecto; solo hace falta para reinvitar en salas `idle`. */
  agents?: ProjectAgentDefinition[]
  onClose: () => void
  onSaved: (room: BrainstormRoom) => void
}

/**
 * Edita el brief de una sala no-running con los mismos campos que al crearla.
 * Los participantes solo se tocan si la sala está `idle` (nunca arrancó): en
 * cuanto hay mensajes, `cursor` y el acta ya referencian esos ids y reordenarlos
 * rompería el turno.
 */
export const BrainstormEditRoomModal: React.FC<BrainstormEditRoomModalProps> = ({
  open,
  active = true,
  cwd,
  room,
  agents = [],
  onClose,
  onSaved,
}) => {
  const { t } = useT()
  const [topic, setTopic] = useState('')
  const [maxRounds, setMaxRounds] = useState(BRAINSTORM_DEFAULT_ROUNDS)
  const [contextIds, setContextIds] = useState<string[]>([])
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const canEditParticipants = room?.status === 'idle'

  useEffect(() => {
    if (!open || !room) return
    setTopic(room.topic)
    setMaxRounds(sanitizeBrainstormMaxRounds(room.maxRounds))
    setContextIds(sanitizeBrainstormWorkingSet(room.contextIds))
    setFilePaths(sanitizeBrainstormWorkingSet(room.filePaths))
    setOutcome(sanitizeBrainstormOutcome(room.outcome) ?? 'ideas')
    setParticipantIds([...room.participantAgentIds])
    setSaving(false)
  }, [open, room])

  // Sin catálogo cargado no se sanea: dejaría la sala sin invitados por una
  // carrera de arranque, no por una decisión del usuario.
  const safeParticipantIds = useMemo(
    () => (agents.length ? sanitizeBrainstormInviteIds(participantIds, agents) : participantIds),
    [participantIds, agents],
  )

  const toggleAgent = (agentId: string): void => {
    const agent = agents.find(item => item.id === agentId)
    if (!agent || !isBrainstormInvitableAgent(agent)) return
    setParticipantIds(previous => {
      const cleaned = sanitizeBrainstormInviteIds(previous, agents)
      return cleaned.includes(agentId)
        ? cleaned.filter(id => id !== agentId)
        : [...cleaned, agentId]
    })
  }

  const canSave = Boolean(topic.trim())
    && !saving
    && room != null
    && room.status !== 'running'
    && safeParticipantIds.length >= 2

  const handleSave = async (): Promise<void> => {
    if (!room || !canSave) return
    const root = cwd.trim()
    if (!root) return
    setSaving(true)
    try {
      const next: BrainstormRoom = {
        ...room,
        topic: topic.trim(),
        maxRounds: sanitizeBrainstormMaxRounds(maxRounds),
        contextIds,
        filePaths,
        outcome,
        ...(canEditParticipants ? { participantAgentIds: safeParticipantIds } : {}),
      }
      const result = await window.api.saveBrainstorm(root, next)
      if (result.ok) onSaved(result.room)
    } finally {
      setSaving(false)
    }
  }

  return (
    <TerminalModal
      open={open && room != null}
      active={active}
      onClose={onClose}
      title={t('tabs.brainstormEditTitle')}
      size="md"
      zIndex={861}
      footer={(
        <div className="brainstorm-edit-room-modal__footer">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={() => { void handleSave() }}
          >
            {t('common.save')}
          </Button>
        </div>
      )}
    >
      <p className="brainstorm-edit-room-modal__hint">
        {canEditParticipants
          ? t('tabs.brainstormEditHintIdle')
          : t('tabs.brainstormEditHint', { count: String(safeParticipantIds.length) })}
      </p>
      {canEditParticipants ? (
        <div className="brainstorm-edit-room-modal__field">
          <span className="brainstorm-edit-room-modal__label">
            {t('tabs.brainstormParticipantsLabel')}
          </span>
          <BrainstormInviteGrid
            agents={agents}
            selectedIds={safeParticipantIds}
            onToggle={toggleAgent}
          />
        </div>
      ) : null}
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
        participantCount={safeParticipantIds.length}
        autoFocus
      />
    </TerminalModal>
  )
}
