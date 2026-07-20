import React, { useEffect, useState } from 'react'
import {
  LOOP_INTERVAL_PRESETS,
  type LoopIntervalPresetId,
} from '@shared/agentLoop'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, ChoiceCard } from '../components/ui'
import './AgentPane.css'

interface Props {
  open: boolean
  initialMs?: number
  onConfirm: (delayMs: number) => void
  onClose: () => void
}

function presetIdForMs(ms: number): LoopIntervalPresetId {
  return (LOOP_INTERVAL_PRESETS.find(preset => preset.ms === ms)?.id ?? '1m') as LoopIntervalPresetId
}

export const AgentLoopIntervalModal: React.FC<Props> = ({
  open,
  initialMs = LOOP_INTERVAL_PRESETS[0].ms,
  onConfirm,
  onClose,
}) => {
  const { t } = useT()
  const [selectedId, setSelectedId] = useState<LoopIntervalPresetId>(() => presetIdForMs(initialMs))

  useEffect(() => {
    if (open) setSelectedId(presetIdForMs(initialMs))
  }, [open, initialMs])

  const selectedMs = LOOP_INTERVAL_PRESETS.find(preset => preset.id === selectedId)?.ms
    ?? LOOP_INTERVAL_PRESETS[0].ms

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.loopIntervalTitle')}
      size="sm"
      zIndex={860}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => onConfirm(selectedMs)} autoFocus>
            {t('agentPane.loopIntervalConfirm')}
          </Button>
        </>
      }
    >
      <p className="agent-loop-interval__description">{t('agentPane.loopIntervalDescription')}</p>
      <div className="agent-loop-interval__options" role="radiogroup" aria-label={t('agentPane.loopIntervalTitle')}>
        {LOOP_INTERVAL_PRESETS.map(preset => (
          <ChoiceCard
            key={preset.id}
            role="radio"
            selected={selectedId === preset.id}
            aria-checked={selectedId === preset.id}
            onClick={() => setSelectedId(preset.id)}
          >
            {t(`agentPane.loopInterval_${preset.id}`)}
          </ChoiceCard>
        ))}
      </div>
    </TerminalModal>
  )
}
