import React, { useEffect, useMemo, useState } from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import {
  appendLoopStep,
  clampLoopChainIntervalMs,
  createLoopChain,
  paneIdsUsedInLoopChains,
} from '@shared/planeLoopChain'
import { loopIntervalPresetByMs } from '@shared/agentLoop'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Button } from '../components/ui'
import { TerminalModal } from '../components/TerminalModal'
import { AgentLoopIntervalModal } from '../agent/AgentLoopIntervalModal'
import { PlaneLoopAgentCard } from './PlaneLoopAgentCard'
import {
  PlaneLoopChainModal,
  type PlaneLoopChainModalMode,
} from './PlaneLoopChainModal'
import './PlaneLoopsSection.css'

export interface PlaneLoopsAgent {
  paneId: string
  title: string
  busy: boolean
  loopActive: boolean
  loopMode?: boolean
  provider?: AgentCliProvider
}

export interface PlaneLoopsSectionProps {
  open: boolean
  title: string
  subtitle: string
  emptyTitle: string
  emptyHint: string
  chainsTitle: string
  chainsEmpty: string
  createChainLabel: string
  appendStepLabel: string
  startChainLabel: string
  stopChainLabel: string
  deleteChainLabel: string
  chainModalTitle: string
  chainModalDescription: string
  appendModalTitle: string
  appendModalDescription: string
  agentLabel: string
  objectiveLabel: string
  objectivePlaceholder: string
  noAgentsHint: string
  noAppendAgentsHint: string
  blockNeedObjectiveHint: string
  chainConfirmLabel: string
  appendConfirmLabel: string
  cancelLabel: string
  statusIdle: string
  statusBusy: string
  statusLooping: string
  chainStatusIdle: string
  chainStatusRunning: string
  chainStatusWaiting: string
  chainStatusStopped: string
  agents: PlaneLoopsAgent[]
  chains: PlaneLoopChain[]
  /** Sin carpeta de proyecto no se puede iniciar una cadena. */
  canStartChains?: boolean
  startBlockedHint?: string
  onClose: () => void
  onChainsChange: (chains: PlaneLoopChain[]) => void
  onStartChain: (chainId: string) => void
  onStopChain: (chainId: string) => void
}

export const PlaneLoopsSection: React.FC<PlaneLoopsSectionProps> = ({
  open,
  title,
  subtitle,
  emptyTitle,
  emptyHint,
  chainsTitle,
  chainsEmpty,
  createChainLabel,
  appendStepLabel,
  startChainLabel,
  stopChainLabel,
  deleteChainLabel,
  chainModalTitle,
  chainModalDescription,
  appendModalTitle,
  appendModalDescription,
  agentLabel,
  objectiveLabel,
  objectivePlaceholder,
  noAgentsHint,
  noAppendAgentsHint,
  blockNeedObjectiveHint,
  chainConfirmLabel,
  appendConfirmLabel,
  cancelLabel,
  statusIdle,
  statusBusy,
  statusLooping,
  chainStatusIdle,
  chainStatusRunning,
  chainStatusWaiting,
  chainStatusStopped,
  agents,
  chains,
  canStartChains = true,
  startBlockedHint = '',
  onClose,
  onChainsChange,
  onStartChain,
  onStopChain,
}) => {
  const { t } = useT()
  const [modal, setModal] = useState<null | { mode: PlaneLoopChainModalMode; chainId?: string }>(null)
  /** Tras elegir agente en «crear»: mismo modal de intervalo que el loop del chat. */
  const [createPaneId, setCreatePaneId] = useState<string | null>(null)
  /** Editar intervalo de una cadena idle (mismo modal). */
  const [editIntervalChainId, setEditIntervalChainId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setModal(null)
      setCreatePaneId(null)
      setEditIntervalChainId(null)
    }
  }, [open])

  const agentById = useMemo(() => {
    const map = new Map<string, PlaneLoopsAgent>()
    for (const agent of agents) map.set(agent.paneId, agent)
    return map
  }, [agents])

  const statusFor = (agent: PlaneLoopsAgent): string => {
    if (agent.loopActive) return statusLooping
    if (agent.busy) return statusBusy
    return statusIdle
  }

  const chainStatusLabel = (chain: PlaneLoopChain): string => {
    switch (chain.status) {
      case 'running': return chainStatusRunning
      case 'waiting': return chainStatusWaiting
      case 'stopped': return chainStatusStopped
      default: return chainStatusIdle
    }
  }

  const intervalLabelFor = (intervalMs: number): string => (
    t(`agentPane.loopInterval_${loopIntervalPresetByMs(intervalMs)}`)
  )

  const agentOptions = useMemo(
    () => agents.map(agent => ({
      paneId: agent.paneId,
      title: agent.title,
      busy: agent.busy,
      loopActive: agent.loopActive,
      provider: agent.provider,
      statusLabel: statusFor(agent),
    })),
    [agents, statusBusy, statusIdle, statusLooping],
  )

  const panesInAnyChain = useMemo(() => paneIdsUsedInLoopChains(chains), [chains])
  const allAgentsClaimed = agents.length > 0 && agents.every(agent => panesInAnyChain.has(agent.paneId))

  const activeModal = modal
  const editChain = editIntervalChainId
    ? chains.find(chain => chain.id === editIntervalChainId)
    : undefined

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={title}
        size="xl"
        bodyLayout="spacious"
        zIndex={860}
        closeOnBackdrop
        footer={
          <Button
            variant="primary"
            size="sm"
            disabled={agents.length === 0 || allAgentsClaimed}
            onClick={() => setModal({
              mode: {
                kind: 'create',
                excludePaneIds: [...panesInAnyChain],
              },
            })}
          >
            {createChainLabel}
          </Button>
        }
      >
        <div className="plane-loops-section">
          <p className="plane-loops-section__subtitle">{subtitle}</p>

          {agents.length === 0 ? (
            <div className="plane-loops-section__empty">
              <Icon name="repeat" size={22} />
              <h3>{emptyTitle}</h3>
              <p>{emptyHint}</p>
            </div>
          ) : (
            <section className="plane-loops-section__block" aria-label={chainsTitle}>
              <h3 className="plane-loops-section__heading">{chainsTitle}</h3>
              {chains.length === 0 ? (
                <p className="plane-loops-section__muted">{chainsEmpty}</p>
              ) : (
                <ul className="plane-loops-section__nests">
                  {chains.map(chain => {
                    const active = chain.status === 'running' || chain.status === 'waiting'
                    const appendAvailable = !active && agents.some(
                      agent => !panesInAnyChain.has(agent.paneId),
                    )
                    return (
                      <li key={chain.id} className="plane-loops-section__nest-row">
                        <div className="plane-loops-section__nest-body">
                          <div className="plane-loops-section__chain-meta">
                            <span className={[
                              'plane-loops-section__chain-status',
                              `plane-loops-section__chain-status--${chain.status}`,
                            ].join(' ')}
                            >
                              {chainStatusLabel(chain)}
                            </span>
                            <button
                              type="button"
                              className="plane-loops-section__chain-interval"
                              disabled={active}
                              title={intervalLabelFor(chain.intervalMs)}
                              onClick={() => setEditIntervalChainId(chain.id)}
                            >
                              {intervalLabelFor(chain.intervalMs)}
                            </button>
                          </div>
                          <div className="plane-loops-section__nest-chain">
                            {chain.steps.map((step, index) => {
                              const agent = agentById.get(step.paneId)
                              const isCurrent =
                                chain.status === 'running' && chain.cursor === index
                              return (
                                <React.Fragment key={`${chain.id}-${step.paneId}`}>
                                  {index > 0 ? (
                                    <span className="plane-loops-section__nest-arrow" aria-hidden>
                                      <Icon name="chevron-right" size={18} />
                                    </span>
                                  ) : null}
                                  {agent ? (
                                    <PlaneLoopAgentCard
                                      title={agent.title}
                                      provider={agent.provider}
                                      busy={agent.busy}
                                      loopActive={agent.loopActive}
                                      statusLabel={statusFor(agent)}
                                      current={isCurrent}
                                      objective={step.objective}
                                    />
                                  ) : (
                                    <p className="plane-loops-section__muted">{step.paneId}</p>
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </div>
                          <div className="plane-loops-section__chain-actions">
                            {active ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => onStopChain(chain.id)}
                              >
                                {stopChainLabel}
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="xs"
                                disabled={!canStartChains}
                                title={!canStartChains ? startBlockedHint : undefined}
                                onClick={() => onStartChain(chain.id)}
                              >
                                {startChainLabel}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={!appendAvailable}
                              onClick={() => setModal({
                                mode: {
                                  kind: 'append',
                                  excludePaneIds: [...panesInAnyChain],
                                },
                                chainId: chain.id,
                              })}
                            >
                              {appendStepLabel}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              title={deleteChainLabel}
                              aria-label={deleteChainLabel}
                              disabled={active}
                              onClick={() => {
                                onChainsChange(chains.filter(item => item.id !== chain.id))
                              }}
                            >
                              <Icon name="trash" size={12} />
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      </TerminalModal>

      <PlaneLoopChainModal
        open={Boolean(activeModal) && open && !createPaneId}
        mode={activeModal?.mode ?? { kind: 'create' }}
        title={activeModal?.mode.kind === 'append' ? appendModalTitle : chainModalTitle}
        description={
          activeModal?.mode.kind === 'append'
            ? appendModalDescription
            : chainModalDescription
        }
        agentLabel={agentLabel}
        objectiveLabel={objectiveLabel}
        objectivePlaceholder={objectivePlaceholder}
        noAgentsHint={
          activeModal?.mode.kind === 'append' ? noAppendAgentsHint : noAgentsHint
        }
        blockNeedObjectiveHint={blockNeedObjectiveHint}
        confirmLabel={
          activeModal?.mode.kind === 'append' ? appendConfirmLabel : chainConfirmLabel
        }
        cancelLabel={cancelLabel}
        flowAgentLabel={t('tabs.loopsFlowAgent')}
        flowTurnLabel={t('tabs.loopsFlowTurn')}
        flowWaitLabel={t('tabs.loopsFlowWait')}
        agents={agentOptions}
        onClose={() => setModal(null)}
        onConfirm={(paneId, objective) => {
          if (!activeModal) return
          if (activeModal.mode.kind === 'create') {
            setModal(null)
            setCreatePaneId(paneId)
            return
          }
          if (activeModal.chainId && objective) {
            const next = chains.map(chain => {
              if (chain.id !== activeModal.chainId) return chain
              return appendLoopStep(chain, paneId, objective) ?? chain
            })
            onChainsChange(next)
          }
          setModal(null)
        }}
      />

      <AgentLoopIntervalModal
        open={Boolean(createPaneId) && open}
        onConfirm={(delayMs, objective) => {
          if (!createPaneId) return
          if (paneIdsUsedInLoopChains(chains).has(createPaneId)) {
            setCreatePaneId(null)
            return
          }
          const created = createLoopChain(createPaneId, objective, delayMs)
          if (created) onChainsChange([...chains, created])
          setCreatePaneId(null)
        }}
        onClose={() => setCreatePaneId(null)}
      />

      <AgentLoopIntervalModal
        open={Boolean(editChain) && open}
        initialMs={editChain?.intervalMs}
        showObjective={false}
        onConfirm={(delayMs) => {
          if (!editChain) return
          const next = chains.map(chain => {
            if (chain.id !== editChain.id) return chain
            return { ...chain, intervalMs: clampLoopChainIntervalMs(delayMs) }
          })
          onChainsChange(next)
          setEditIntervalChainId(null)
        }}
        onClose={() => setEditIntervalChainId(null)}
      />
    </>
  )
}
