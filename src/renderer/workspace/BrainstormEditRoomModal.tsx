import React, { useEffect, useState } from 'react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_MAX_ROUNDS_CAP,
  sanitizeBrainstormMaxRounds,
} from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, Select, TextArea } from '../components/ui'
import './BrainstormEditRoomModal.css'

export interface BrainstormEditRoomModalProps {
  open: boolean
  active?: boolean
  cwd: string
  room: BrainstormRoom | null
  onClose: () => void
  onSaved: (room: BrainstormRoom) => void
}

/** Edita solo topic + maxRounds de una sala no-running. */
export const BrainstormEditRoomModal: React.FC<BrainstormEditRoomModalProps> = ({
  open,
  active = true,
  cwd,
  room,
  onClose,
  onSaved,
}) => {
  const { t } = useT()
  const [topic, setTopic] = useState('')
  const [maxRounds, setMaxRounds] = useState(BRAINSTORM_DEFAULT_ROUNDS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !room) return
    setTopic(room.topic)
    setMaxRounds(sanitizeBrainstormMaxRounds(room.maxRounds))
    setSaving(false)
  }, [open, room])

  const canSave = Boolean(topic.trim()) && !saving && room != null && room.status !== 'running'

  const roundOptions = Array.from(
    { length: BRAINSTORM_MAX_ROUNDS_CAP },
    (_, index) => index + 1,
  )

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
      size="sm"
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
      <label className="brainstorm-edit-room-modal__field">
        <span className="brainstorm-edit-room-modal__label">{t('tabs.brainstormTopicLabel')}</span>
        <TextArea
          value={topic}
          autoFocus
          rows={3}
          onChange={event => setTopic(event.target.value)}
        />
      </label>
      <label className="brainstorm-edit-room-modal__field">
        <span className="brainstorm-edit-room-modal__label">{t('tabs.brainstormRoundsLabel')}</span>
        <Select
          size="sm"
          value={String(maxRounds)}
          onChange={next => {
            setMaxRounds(sanitizeBrainstormMaxRounds(Number(next)))
          }}
          options={roundOptions.map(value => ({ value: String(value), label: String(value) }))}
        />
      </label>
    </TerminalModal>
  )
}
