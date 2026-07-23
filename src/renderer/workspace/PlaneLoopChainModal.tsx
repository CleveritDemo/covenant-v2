import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { TerminalModal } from '../components/TerminalModal'
import { Button, TextArea } from '../components/ui'
import { PlaneLoopAgentCard } from './PlaneLoopAgentCard'
import { PlaneLoopModalSection } from './PlaneLoopModalSection'
import './PlaneLoopNestModal.css'

export interface PlaneLoopChainAgentOption {
  paneId: string
  title: string
  busy: boolean
  loopActive: boolean
  provider?: AgentCliProvider
  statusLabel: string
}

export type PlaneLoopChainModalMode =
  | { kind: 'create'; excludePaneIds?: readonly string[] }
  | { kind: 'append'; excludePaneIds: readonly string[] }

export interface PlaneLoopChainModalProps {
  open: boolean
  mode: PlaneLoopChainModalMode
  title: string
  description: string
  agentLabel: string
  objectiveLabel: string
  objectivePlaceholder: string
  noAgentsHint: string
  blockNeedObjectiveHint: string
  confirmLabel: string
  cancelLabel: string
  /** Etiquetas cortas del flujo visual (agente → turno → espera). */
  flowAgentLabel: string
  flowTurnLabel: string
  flowWaitLabel: string
  agents: PlaneLoopChainAgentOption[]
  /** Create: solo paneId. Append: paneId + objective. */
  onConfirm: (paneId: string, objective?: string) => void
  onClose: () => void
}

export const PlaneLoopChainModal: React.FC<PlaneLoopChainModalProps> = ({
  open,
  mode,
  title,
  description,
  agentLabel,
  objectiveLabel,
  objectivePlaceholder,
  noAgentsHint,
  blockNeedObjectiveHint,
  confirmLabel,
  cancelLabel,
  flowAgentLabel,
  flowTurnLabel,
  flowWaitLabel,
  agents,
  onConfirm,
  onClose,
}) => {
  const [paneId, setPaneId] = useState('')
  const [objective, setObjective] = useState('')
  const objectiveRef = useRef<HTMLTextAreaElement>(null)
  const isAppend = mode.kind === 'append'

  const exclude = useMemo(
    () => new Set(mode.excludePaneIds ?? []),
    [mode],
  )
  const selectable = useMemo(
    () => agents.filter(agent => !exclude.has(agent.paneId)),
    [agents, exclude],
  )
  const selected = useMemo(
    () => selectable.find(agent => agent.paneId === paneId) ?? null,
    [paneId, selectable],
  )

  useEffect(() => {
    if (!open) return
    setPaneId('')
    setObjective('')
  }, [open, mode.kind])

  useEffect(() => {
    if (!open || !paneId || !isAppend) return
    const timer = window.setTimeout(() => objectiveRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open, paneId, isAppend])

  const objectiveOk = !isAppend || objective.trim().length > 0
  const canConfirm = Boolean(paneId) && objectiveOk
  const blockHint = isAppend && paneId && !objectiveOk ? blockNeedObjectiveHint : ''

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      bodyLayout="spacious"
      zIndex={880}
      closeOnBackdrop
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return
              if (isAppend) onConfirm(paneId, objective.trim())
              else onConfirm(paneId)
            }}
          >
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="plane-loop-nest-modal">
        <div className="plane-loop-nest-modal__intro">
          <p className="plane-loop-nest-modal__description">{description}</p>
          {!isAppend ? (
            <div className="plane-loop-nest-modal__flow" aria-hidden="true">
              <span className="plane-loop-nest-modal__flow-chip plane-loop-nest-modal__flow-chip--accent">
                {flowAgentLabel}
              </span>
              <span className="plane-loop-nest-modal__flow-arrow">→</span>
              <span className="plane-loop-nest-modal__flow-chip">{flowTurnLabel}</span>
              <span className="plane-loop-nest-modal__flow-arrow">→</span>
              <span className="plane-loop-nest-modal__flow-chip">{flowWaitLabel}</span>
              <span className="plane-loop-nest-modal__flow-arrow">↻</span>
            </div>
          ) : null}
        </div>

        <PlaneLoopModalSection step={1} title={agentLabel}>
          {selectable.length === 0 ? (
            <div className="plane-loop-nest-modal__empty">
              <p className="plane-loop-nest-modal__empty-title">{noAgentsHint}</p>
            </div>
          ) : (
            <div className="plane-loop-nest-modal__cards">
              {selectable.map(agent => (
                <PlaneLoopAgentCard
                  key={agent.paneId}
                  title={agent.title}
                  provider={agent.provider}
                  busy={agent.busy}
                  loopActive={agent.loopActive}
                  statusLabel={agent.statusLabel}
                  selected={paneId === agent.paneId}
                  onSelect={() => setPaneId(agent.paneId)}
                />
              ))}
            </div>
          )}
        </PlaneLoopModalSection>

        {isAppend && paneId ? (
          <PlaneLoopModalSection step={2} title={objectiveLabel}>
            {selected ? (
              <div className="plane-loop-nest-modal__selected">
                <span className="plane-loop-nest-modal__selected-dot" aria-hidden="true" />
                <span>{selected.title}</span>
              </div>
            ) : null}
            <TextArea
              ref={objectiveRef}
              value={objective}
              onChange={event => setObjective(event.target.value)}
              placeholder={objectivePlaceholder}
              rows={3}
            />
            {blockHint ? (
              <p className="plane-loop-nest-modal__hint plane-loop-nest-modal__hint--warn">
                {blockHint}
              </p>
            ) : null}
          </PlaneLoopModalSection>
        ) : null}
      </div>
    </TerminalModal>
  )
}
