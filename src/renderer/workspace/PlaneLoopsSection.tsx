import React, { useEffect, useMemo, useState } from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import {
  appendLoopStep,
  clampLoopChainIntervalMs,
  createLoopChain,
  moveLoopStep,
  agentIdsUsedInLoopChains,
  setLoopStepObjective,
} from '@shared/planeLoopChain'
import { loopIntervalPresetByMs } from '@shared/agentLoop'
import { agentCliSpec } from '@shared/agentCliProviders'
import { agentMonogram } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { BrandIcon } from '../components/ui/BrandIcon'
import { Button } from '../components/ui'
import { TerminalModal } from '../components/TerminalModal'
import { AgentLoopIntervalModal } from '../agent/AgentLoopIntervalModal'
import { LoopChainTranscriptPanel } from './LoopChainTranscriptPanel'
import type { LoopChainLiveSlice } from './useLoopChainLiveState'
import './PlaneLoopsSection.css'

export interface PlaneLoopsAgent {
  agentId: string
  title: string
  monogram?: string
  busy: boolean
  provider?: AgentCliProvider
}

export interface PlaneLoopsSectionProps {
  open: boolean
  agents: PlaneLoopsAgent[]
  chains: PlaneLoopChain[]
  liveByChainId?: Readonly<Record<string, LoopChainLiveSlice>>
  /** Sin carpeta de proyecto no se puede iniciar una cadena. */
  canStartChains?: boolean
  startBlockedHint?: string
  onClose: () => void
  onChainsChange: (chains: PlaneLoopChain[]) => void
  onStartChain: (chainId: string) => void
  onStopChain: (chainId: string) => void
}

/** Alta de paso en línea: `chainId` null = cadena nueva todavía sin crear. */
interface StepDraft {
  chainId: string | null
  agentId: string | null
  objective: string
}

function isChainActive(
  chain: PlaneLoopChain,
  live?: LoopChainLiveSlice,
): boolean {
  if (live) return live.status === 'running' || live.status === 'waiting'
  return chain.status === 'running' || chain.status === 'waiting'
}

function effectiveChainStatus(
  chain: PlaneLoopChain,
  live?: LoopChainLiveSlice,
): PlaneLoopChain['status'] {
  if (live?.status === 'running') return 'running'
  if (live?.status === 'waiting') return 'waiting'
  if (live?.status === 'stopped') return 'stopped'
  return chain.status
}

/** Ventana Loops: la cadena es la interfaz (pista + retorno con intervalo). */
export const PlaneLoopsSection: React.FC<PlaneLoopsSectionProps> = ({
  open,
  agents,
  chains,
  liveByChainId = {},
  canStartChains = true,
  startBlockedHint = '',
  onClose,
  onChainsChange,
  onStartChain,
  onStopChain,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState<StepDraft | null>(null)
  /** Cadena cuyo intervalo se está editando (mismo modal que el loop del chat). */
  const [intervalChainId, setIntervalChainId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ chainId: string; from: number } | null>(null)
  const [transcriptChainId, setTranscriptChainId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setIntervalChainId(null)
      setDrag(null)
      setTranscriptChainId(null)
    }
  }, [open])

  const agentById = useMemo(() => {
    const map = new Map<string, PlaneLoopsAgent>()
    for (const agent of agents) map.set(agent.agentId, agent)
    return map
  }, [agents])

  const agentTitleById = useMemo(
    () => new Map(agents.map(agent => [agent.agentId, agent.title])),
    [agents],
  )

  const claimed = useMemo(() => agentIdsUsedInLoopChains(chains), [chains])
  const freeAgents = useMemo(
    () => agents.filter(agent => !claimed.has(agent.agentId)),
    [agents, claimed],
  )

  const intervalChain = intervalChainId
    ? chains.find(chain => chain.id === intervalChainId)
    : undefined

  const statusFor = (agent: PlaneLoopsAgent): string => {
    if (agent.busy) return t('tabs.loopsStatusBusy')
    return t('tabs.loopsStatusIdle')
  }

  const chainStatusLabel = (chain: PlaneLoopChain, live?: LoopChainLiveSlice): string => {
    switch (effectiveChainStatus(chain, live)) {
      case 'running': return t('tabs.loopsChainStatusRunning')
      case 'waiting': return t('tabs.loopsChainStatusWaiting')
      case 'stopped': return t('tabs.loopsChainStatusStopped')
      default: return t('tabs.loopsChainStatusIdle')
    }
  }

  const intervalLabelFor = (intervalMs: number): string => (
    t(`agentPane.loopInterval_${loopIntervalPresetByMs(intervalMs)}`)
  )

  const patchChain = (
    chainId: string,
    patch: (chain: PlaneLoopChain) => PlaneLoopChain,
  ): void => {
    onChainsChange(chains.map(chain => (chain.id === chainId ? patch(chain) : chain)))
  }

  const commitDraft = (): void => {
    if (!draft?.agentId) return
    const objective = draft.objective.trim()
    if (!objective) return
    if (draft.chainId === null) {
      const created = createLoopChain(draft.agentId, objective)
      if (!created) return
      onChainsChange([...chains, created])
      // Encadenar: el siguiente paso se añade sin volver a abrir nada.
      const remaining = freeAgents.filter(agent => agent.agentId !== draft.agentId)
      setDraft(remaining.length
        ? { chainId: created.id, agentId: null, objective: '' }
        : null)
      return
    }
    patchChain(draft.chainId, chain => appendLoopStep(chain, draft.agentId!, objective) ?? chain)
    setDraft(null)
  }

  const renderStep = (
    chain: PlaneLoopChain,
    step: PlaneLoopChain['steps'][number],
    index: number,
    live?: LoopChainLiveSlice,
  ): React.ReactNode => {
    const agent = agentById.get(step.agentId)
    const active = isChainActive(chain, live)
    const current = live
      ? live.status === 'running' && live.stepIndex === index
      : chain.status === 'running' && chain.cursor === index
    const provider = agent?.provider ?? 'claude'
    const liveText = current && live?.lastText.trim() ? live.lastText.trim() : ''
    return (
      <li
        key={step.agentId}
        className={[
          'plane-loops__step',
          current ? 'plane-loops__step--current' : '',
        ].filter(Boolean).join(' ')}
        draggable={!active && chain.steps.length > 1}
        onDragStart={() => setDrag({ chainId: chain.id, from: index })}
        onDragEnd={() => setDrag(null)}
        onDragOver={event => {
          if (drag?.chainId === chain.id) event.preventDefault()
        }}
        onDrop={event => {
          if (drag?.chainId !== chain.id) return
          event.preventDefault()
          patchChain(chain.id, item => moveLoopStep(item, drag.from, index))
          setDrag(null)
        }}
      >
        <span className="plane-loops__avatar" aria-hidden>
          {(agent?.monogram?.trim() || agentMonogram(agent?.title ?? step.agentId)).toUpperCase()}
        </span>
        <div className="plane-loops__step-body">
          <div className="plane-loops__step-who">
            <b>{agent?.title ?? step.agentId}</b>
            <span
              className="plane-loops__provider"
              style={{ '--plane-loops-brand': agentCliSpec(provider).brand } as React.CSSProperties}
              aria-label={agentCliSpec(provider).label}
            >
              <BrandIcon provider={provider} size={9} aria-hidden />
            </span>
            <span className="plane-loops__step-state">
              {current
                ? (liveText
                  ? t('tabs.loopsStepStreaming')
                  : t('tabs.loopsStepWorking'))
                : agent ? statusFor(agent) : t('tabs.loopsStepMissing')}
            </span>
          </div>
          {liveText ? (
            <p className="plane-loops__live-text">{liveText}</p>
          ) : null}
          <input
            key={`${step.agentId}-${step.objective}`}
            className="plane-loops__objective"
            defaultValue={step.objective}
            readOnly={active}
            aria-label={t('tabs.loopsObjective')}
            placeholder={t('tabs.loopsObjectivePlaceholder')}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                event.currentTarget.value = step.objective
                event.currentTarget.blur()
              }
            }}
            onBlur={event => {
              const next = event.currentTarget.value.trim()
              if (!next || next === step.objective) {
                event.currentTarget.value = step.objective
                return
              }
              patchChain(chain.id, item => setLoopStepObjective(item, step.agentId, next))
            }}
          />
        </div>
        {!active && chain.steps.length > 1 ? (
          <span className="plane-loops__drag" aria-label={t('tabs.loopsReorder')}>
            <Icon name="drag-handle" size={12} />
          </span>
        ) : null}
      </li>
    )
  }

  const renderDraft = (chainId: string | null): React.ReactNode => {
    const pending = draft && draft.chainId === chainId ? draft : null
    if (!pending) {
      if (chainId === null) return null
      const chain = chains.find(item => item.id === chainId)
      if (!chain || isChainActive(chain, liveByChainId[chainId]) || freeAgents.length === 0) return null
      return (
        <button
          type="button"
          className="plane-loops__slot"
          onClick={() => setDraft({ chainId, agentId: null, objective: '' })}
        >
          <span className="plane-loops__avatar plane-loops__avatar--slot" aria-hidden>
            <Icon name="plus" size={12} />
          </span>
          <span>{t('tabs.loopsAppendStep')}</span>
        </button>
      )
    }

    const picked = pending.agentId ? agentById.get(pending.agentId) : undefined
    return (
      <div className="plane-loops__picker">
        {!picked ? (
          <>
            <span className="plane-loops__picker-label">{t('tabs.loopsAgent')}</span>
            {freeAgents.length === 0 ? (
              <p className="plane-loops__muted">{t('tabs.loopsNoAppendAgents')}</p>
            ) : (
              <div className="plane-loops__agents">
                {freeAgents.map(agent => (
                  <button
                    key={agent.agentId}
                    type="button"
                    className="plane-loops__chip"
                    onClick={() => setDraft({ ...pending, agentId: agent.agentId })}
                  >
                    <span className="plane-loops__chip-monogram" aria-hidden>
                      {(agent.monogram?.trim() || agentMonogram(agent.title)).toUpperCase()}
                    </span>
                    <span>{agent.title}</span>
                    <small>{statusFor(agent)}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="plane-loops__picker-actions">
              <Button variant="ghost" size="xs" onClick={() => setDraft(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </>
        ) : (
          <div className="plane-loops__picker-row">
            <span className="plane-loops__chip plane-loops__chip--static">
              <span className="plane-loops__chip-monogram" aria-hidden>
                {(picked.monogram?.trim() || agentMonogram(picked.title)).toUpperCase()}
              </span>
              <span>{picked.title}</span>
            </span>
            <input
              className="plane-loops__objective plane-loops__objective--draft"
              autoFocus
              value={pending.objective}
              aria-label={t('tabs.loopsObjective')}
              placeholder={t('tabs.loopsObjectivePlaceholder')}
              onChange={event => setDraft({ ...pending, objective: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter') commitDraft()
                if (event.key === 'Escape') setDraft(null)
              }}
            />
            <Button
              variant="primary"
              size="xs"
              disabled={!pending.objective.trim()}
              onClick={commitDraft}
            >
              {t('tabs.loopsAppendStep')}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderChain = (chain: PlaneLoopChain): React.ReactNode => {
    const live = liveByChainId[chain.id]
    const active = isChainActive(chain, live)
    const status = effectiveChainStatus(chain, live)
    const showTranscript = transcriptChainId === chain.id
    return (
      <li key={chain.id} className="plane-loops__chain">
        <header className="plane-loops__chain-head">
          <span className={`plane-loops__pill plane-loops__pill--${status}`}>
            {chainStatusLabel(chain, live)}
          </span>
          <span className="plane-loops__chain-meta">
            {live && (live.status === 'running' || live.status === 'waiting')
              ? t('tabs.loopsChainCycle', { cycle: live.cycle })
              : t('tabs.loopsChainSteps', { count: chain.steps.length })}
          </span>
          {!active && !canStartChains && startBlockedHint ? (
            <span className="plane-loops__chain-meta">{startBlockedHint}</span>
          ) : null}
          <span className="plane-loops__spacer" />
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={showTranscript}
            onClick={() => setTranscriptChainId(showTranscript ? null : chain.id)}
          >
            {showTranscript ? t('tabs.loopsHideTranscript') : t('tabs.loopsViewTranscript')}
          </Button>
          {active ? (
            <Button variant="ghost" size="xs" onClick={() => onStopChain(chain.id)}>
              {t('tabs.loopsStopChain')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              disabled={!canStartChains}
              onClick={() => onStartChain(chain.id)}
            >
              {t('tabs.loopsStartChain')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            aria-label={t('tabs.loopsDeleteChain')}
            disabled={active}
            onClick={() => {
              if (draft?.chainId === chain.id) setDraft(null)
              onChainsChange(chains.filter(item => item.id !== chain.id))
            }}
          >
            <Icon name="trash" size={12} />
          </Button>
        </header>

        <div className={[
          'plane-loops__track',
          status === 'waiting' ? 'plane-loops__track--waiting' : '',
        ].filter(Boolean).join(' ')}
        >
          <ul className="plane-loops__steps">
            {chain.steps.map((step, index) => renderStep(chain, step, index, live))}
          </ul>
          {renderDraft(chain.id)}
          <span className="plane-loops__loopback" aria-hidden />
          <button
            type="button"
            className="plane-loops__interval"
            disabled={active}
            onClick={() => setIntervalChainId(chain.id)}
          >
            <Icon name="repeat" size={11} />
            <span>{intervalLabelFor(chain.intervalMs)}</span>
          </button>
        </div>
        {showTranscript ? (
          <LoopChainTranscriptPanel
            chainId={chain.id}
            agentTitleById={agentTitleById}
          />
        ) : null}
      </li>
    )
  }

  const newChainDraft = draft?.chainId === null ? draft : null

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={t('tabs.loopsTitle')}
        size="xl"
        bodyLayout="spacious"
        zIndex={860}
        closeOnBackdrop
        footer={
          <Button
            variant="primary"
            size="sm"
            disabled={freeAgents.length === 0 || Boolean(newChainDraft)}
            onClick={() => setDraft({ chainId: null, agentId: null, objective: '' })}
          >
            {t('tabs.loopsCreateChain')}
          </Button>
        }
      >
        <div className="plane-loops">
          <p className="plane-loops__subtitle">{t('tabs.loopsSubtitle')}</p>

          {agents.length === 0 ? (
            <div className="plane-loops__empty">
              <Icon name="repeat" size={22} />
              <h3>{t('tabs.loopsEmptyTitle')}</h3>
              <p>{t('tabs.loopsEmptyHint')}</p>
            </div>
          ) : (
            <ul className="plane-loops__chains" aria-label={t('tabs.loopsChainsTitle')}>
              {chains.map(renderChain)}

              {newChainDraft ? (
                <li className="plane-loops__chain plane-loops__chain--draft">
                  <div className="plane-loops__track">{renderDraft(null)}</div>
                </li>
              ) : null}

              {chains.length === 0 && !newChainDraft ? (
                <li className="plane-loops__chain plane-loops__chain--draft">
                  <div className="plane-loops__track">
                    <button
                      type="button"
                      className="plane-loops__slot"
                      onClick={() => setDraft({ chainId: null, agentId: null, objective: '' })}
                    >
                      <span className="plane-loops__avatar plane-loops__avatar--slot" aria-hidden>
                        <Icon name="plus" size={12} />
                      </span>
                      <span>{t('tabs.loopsFirstStep')}</span>
                    </button>
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </TerminalModal>

      <AgentLoopIntervalModal
        open={Boolean(intervalChain) && open}
        initialMs={intervalChain?.intervalMs}
        showObjective={false}
        onConfirm={delayMs => {
          if (!intervalChain) return
          patchChain(intervalChain.id, chain => ({
            ...chain,
            intervalMs: clampLoopChainIntervalMs(delayMs),
          }))
          setIntervalChainId(null)
        }}
        onClose={() => setIntervalChainId(null)}
      />
    </>
  )
}
