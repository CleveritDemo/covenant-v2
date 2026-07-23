import React, { useEffect, useRef, useState } from 'react'
import {
  LOOP_INTERVAL_PRESETS,
  formatLoopIntervalMs,
  type LoopIntervalPresetId,
} from '@shared/agentLoop'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, ChoiceCard, TextArea } from '../components/ui'
import { PlaneLoopModalSection } from '../workspace/PlaneLoopModalSection'
import './AgentLoopIntervalModal.css'

interface Props {
  open: boolean
  initialMs?: number
  /** Objetivo / interacción a repetir en el loop. */
  initialObjective?: string
  /**
   * Si false, solo edita el intervalo (sin campo ni overwrite de objetivo).
   * @default true
   */
  showObjective?: boolean
  onConfirm: (delayMs: number, objective: string) => void
  onClose: () => void
}

function presetIdForMs(ms: number): LoopIntervalPresetId {
  return (LOOP_INTERVAL_PRESETS.find(preset => preset.ms === ms)?.id ?? '1m') as LoopIntervalPresetId
}

export const AgentLoopIntervalModal: React.FC<Props> = ({
  open,
  initialMs = LOOP_INTERVAL_PRESETS[0].ms,
  initialObjective = '',
  showObjective = true,
  onConfirm,
  onClose,
}) => {
  const { t } = useT()
  const [selectedId, setSelectedId] = useState<LoopIntervalPresetId>(() => presetIdForMs(initialMs))
  const [objective, setObjective] = useState(initialObjective)
  const wasOpenRef = useRef(false)

  // Solo reseeding al abrir: evita resetear el texto mientras se escribe.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedId(presetIdForMs(initialMs))
      setObjective(initialObjective)
    }
    wasOpenRef.current = open
  }, [open, initialMs, initialObjective])

  const selectedMs = LOOP_INTERVAL_PRESETS.find(preset => preset.id === selectedId)?.ms
    ?? LOOP_INTERVAL_PRESETS[0].ms
  const trimmedObjective = objective.trim()
  const canConfirm = !showObjective || trimmedObjective.length > 0
  const cadenceStep = showObjective ? 2 : 1

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={
        showObjective
          ? t('agentPane.loopIntervalTitle')
          : t('agentPane.loopIntervalEditTitle')
      }
      size="md"
      bodyLayout="spacious"
      zIndex={920}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedMs, showObjective ? trimmedObjective : '')}
          >
            {showObjective
              ? t('agentPane.loopIntervalConfirm')
              : t('agentPane.loopIntervalEditConfirm')}
          </Button>
        </>
      }
    >
      <div className="agent-loop-interval">
        <p className="agent-loop-interval__description">
          {showObjective
            ? t('agentPane.loopIntervalDescription')
            : t('agentPane.loopIntervalEditDescription')}
        </p>

        {showObjective ? (
          <PlaneLoopModalSection
            step={1}
            title={t('agentPane.loopObjectiveLabel')}
            hint={t('agentPane.loopHint')}
          >
            <TextArea
              size="md"
              rows={4}
              value={objective}
              placeholder={t('agentPane.loopPlaceholder')}
              onChange={event => setObjective(event.target.value)}
              aria-label={t('agentPane.loopObjectiveLabel')}
            />
          </PlaneLoopModalSection>
        ) : null}

        <PlaneLoopModalSection
          step={cadenceStep}
          title={t('agentPane.loopIntervalCadenceLabel')}
          hint={t('agentPane.loopIntervalCadenceHint')}
        >
          <div
            className="agent-loop-interval__options"
            role="radiogroup"
            aria-label={t('agentPane.loopIntervalCadenceLabel')}
          >
            {LOOP_INTERVAL_PRESETS.map(preset => (
              <ChoiceCard
                key={preset.id}
                role="radio"
                selected={selectedId === preset.id}
                aria-checked={selectedId === preset.id}
                onClick={() => setSelectedId(preset.id)}
              >
                <strong>{formatLoopIntervalMs(preset.ms)}</strong>
                <span className="agent-loop-interval__option-sub">
                  {t(`agentPane.loopInterval_${preset.id}`)}
                </span>
              </ChoiceCard>
            ))}
          </div>
        </PlaneLoopModalSection>
      </div>
    </TerminalModal>
  )
}
