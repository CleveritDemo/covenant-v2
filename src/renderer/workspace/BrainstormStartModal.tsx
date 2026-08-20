import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  brainstormCatalogAgentLabel,
  brainstormRunMinutes,
  filterBrainstormInvitableAgents,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import {
  candidateCeremonyRoles,
  ceremonyById,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
} from '@shared/agileCeremonies'
import { agentMonogram } from '@shared/tabContextAppearance'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { NO_CONTEXT_USAGE, resolveAssignedContextChips } from './resolveAssignedContextChips'
import { CEREMONY_ROLE_KEY } from './ceremonyLabels'
import type { IssueMentionPicked } from '@shared/issueMention'
import { githubIssueDraftFromRef } from '@shared/githubIssueDraft'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { useIssueMention } from './useIssueMention'
import { Button, TextArea } from '../components/ui'
import { BrainstormOverlay } from './BrainstormOverlay'
import { BrainstormModuleTabs } from './BrainstormModuleTabs'
import { BrainstormInviteSeatCard } from './BrainstormSeatCard'
import { BrainstormSentence } from './BrainstormSentence'
import { tryCreateBrainstormSession } from './brainstormUiGuards'
import { useBrainstormContextDrop } from './brainstormContextDrop'
import './BrainstormInviteGrid.css'
import './BrainstormStartModal.css'

export interface BrainstormStartModalProps {
  open: boolean
  active?: boolean
  cwd: string
  agents: ProjectAgentDefinition[]
  /**
   * Agentes que ya tienen asiento en otra sala viva, por id → temas de esas
   * salas. Se puede sentar al mismo agente en varias: los contextos son
   * independientes, así que la tarjeta lo avisa antes de sentarlo.
   */
  agentsInLiveRooms?: Readonly<Record<string, readonly string[]>>
  /**
   * Catálogo de contextos del proyecto: la columna de invitados pinta los del
   * agente con su icono y color reales, igual que la mini del plano.
   */
  contexts?: readonly TabContext[]
  /** Actas guardadas: el número va en la pestaña de la biblioteca. */
  savedRoomsCount?: number
  onClose: () => void
  /** Volver a la biblioteca, que es la otra pestaña del módulo. */
  onOpenRooms?: () => void
  onStarted: (room: BrainstormRoom) => void
  /** Abre el flujo de alta de agente ya existente en App (`requestAddAgent`). */
  onCreateAgent?: () => void
  /** Soltar un contexto del riel sobre una tarjeta de invitación. */
  onAssignContext?: (agentId: string, contextId: string) => void
  /** Borrador de la guía: objetivo y cuántos asientos, también al vaciar. */
  onDraftChange?: (draft: { goalFilled: boolean; participantCount: number }) => void
}

/**
 * Alta de una sala sobre el plano entero, no en un modal: el objetivo se lleva
 * el centro, los invitados van en la columna de la derecha —donde el plano ya
 * pone a los agentes— y lo que antes vivía detrás del desplegable «Formato y
 * ajustes» se queda abierto en la columna de la izquierda. Con la pantalla
 * completa no hacía falta esconderlo.
 *
 * El orden importa: el objetivo va primero porque es lo único sin un valor por
 * defecto razonable. El formato cae a `free` y se cambia solo si hace falta.
 */
export const BrainstormStartModal: React.FC<BrainstormStartModalProps> = ({
  open,
  active = true,
  cwd,
  agents,
  agentsInLiveRooms = {},
  contexts = [],
  savedRoomsCount = 0,
  onClose,
  onOpenRooms,
  onStarted,
  onCreateAgent,
  onAssignContext,
  onDraftChange,
}) => {
  const { t } = useT()
  const { dropAgentId, handlersFor } = useBrainstormContextDrop(onAssignContext)
  const [topic, setTopic] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [ceremony, setCeremony] = useState<CeremonyId>(DEFAULT_CEREMONY_ID)
  const [maxRounds, setMaxRounds] = useState(ceremonyById(DEFAULT_CEREMONY_ID).rounds)
  const [contextIds, setContextIds] = useState<string[]>([])
  const topicRef = useRef<HTMLTextAreaElement>(null)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')

  const resetDraft = useCallback((): void => {
    setTopic('')
    setParticipantIds([])
    setCeremony(DEFAULT_CEREMONY_ID)
    setMaxRounds(ceremonyById(DEFAULT_CEREMONY_ID).rounds)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [])

  /**
   * El borrador sobrevive a cerrar y volver a abrir: esto se reseteaba al
   * ABRIR, así que tocar el toggle sin querer costaba todo lo que llevabas
   * armado. Se limpia al arrancar la sala —ahí el borrador ya se gastó— y al
   * cambiar de proyecto, que es otro contexto y otro material.
   */
  useEffect(() => {
    resetDraft()
  }, [cwd, resetDraft])

  useEffect(() => {
    onDraftChange?.({
      goalFilled: topic.trim().length > 0,
      participantCount: participantIds.length,
    })
  }, [topic, participantIds, onDraftChange])

  const invitableAgents = useMemo(
    () => filterBrainstormInvitableAgents(agents),
    [agents],
  )

  const safeParticipantIds = useMemo(
    () => sanitizeBrainstormInviteIds(participantIds, agents),
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

  /**
   * Reordenar el orden de habla arrastrando (lo hace `BrainstormSentence`, en
   * el cajón de quién habla). El orden no es cosmético: es el turno de cada uno.
   */
  const moveSeat = (from: number, to: number): void => {
    if (from === to) return
    setParticipantIds(previous => {
      const cleaned = sanitizeBrainstormInviteIds(previous, agents)
      if (from < 0 || from >= cleaned.length || to < 0 || to >= cleaned.length) return cleaned
      const next = [...cleaned]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /** Cambiar de formato reajusta las rondas a las que ese formato sugiere. */
  const handleCeremonyChange = (next: CeremonyId): void => {
    setCeremony(next)
    setMaxRounds(ceremonyById(next).rounds)
  }

  /**
   * La issue elegida entra en el material de la sala además de escribirse en el
   * objetivo: la sala arranca con el ticket adjunto, sin pegarlo a mano.
   */
  const attachIssue = useCallback((picked: IssueMentionPicked): void => {
    const context = picked.source === 'jira'
      ? jiraDraftFromKey(picked.issue.key)
      : githubIssueDraftFromRef(picked.issue)
    if (!context || !cwd.trim()) return
    void window.api.materializeTabContext({ context, cwd }).then(result => {
      if (!result.ok) return
      setContextIds(previous => (
        previous.includes(context.id) ? previous : [...previous, context.id]
      ))
    }).catch(() => {
      // Sin `.md` en disco no hay contexto real que sumar.
    })
  }, [cwd])

  const mention = useIssueMention({
    cwd,
    value: topic,
    onValueChange: setTopic,
    inputRef: topicRef,
    onPicked: attachIssue,
    placement: 'down',
    showEmptyState: true,
  })

  const materialCount = contextIds.length + filePaths.length
  const turns = safeParticipantIds.length * sanitizeBrainstormMaxRounds(maxRounds)

  /**
   * Lo que impide empezar, en el orden en que se resuelve. El botón ya sabía
   * decir «no» pero no decía por qué faltaba escribir el objetivo — el único
   * requisito que no tenía aviso en ninguna parte.
   */
  const peopleMissing = Math.max(0, 2 - safeParticipantIds.length)
  const missing = [
    topic.trim() ? '' : t('tabs.brainstormMissingGoal'),
    peopleMissing === 0
      ? ''
      : peopleMissing === 1
        ? t('tabs.brainstormMissingPeopleOne')
        : t('tabs.brainstormMissingPeopleMany', { count: String(peopleMissing) }),
  ].filter(Boolean)

  const brief = { contextIds, filePaths, outcome, ceremony }
  const canStart = Boolean(
    tryCreateBrainstormSession(topic, safeParticipantIds, maxRounds, agents, brief),
  ) && Boolean(cwd.trim())

  const handleStart = (): void => {
    const room = tryCreateBrainstormSession(
      topic,
      safeParticipantIds,
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
    // El borrador ya se gastó: la siguiente sala empieza en blanco.
    resetDraft()
  }

  /** Rol con el que se sienta: los de ceremonia mandan, el libre es respaldo. */
  const roleLabelOf = (agent: ProjectAgentDefinition): string => {
    const ceremonyRoles = candidateCeremonyRoles(agent)
    if (ceremonyRoles.length) {
      return ceremonyRoles.map(id => t(CEREMONY_ROLE_KEY[id])).join(' · ')
    }
    return agent.role?.trim() ?? ''
  }

  if (!open) return null

  return (
    <BrainstormOverlay
      active={active}
      variant="setup"
      ariaLabel={t('tabs.brainstormStartTitle')}
      closeLabel={t('common.cancel')}
      onClose={onClose}
      seatCount={invitableAgents.length}
      rightAnchor="brainstorm-participants"
      chrome={(
        <BrainstormModuleTabs
          tab="new"
          roomsCount={savedRoomsCount}
          onRooms={() => onOpenRooms?.()}
          onNew={() => {}}
        />
      )}
      right={(
        <>
          <div className="brainstorm-overlay__col-head">
            <span className="brainstorm-overlay__col-title">
              {t('tabs.brainstormParticipantsLabel')}
            </span>
            <span className="brainstorm-overlay__col-count">
              {safeParticipantIds.length}
              /
              {invitableAgents.length}
            </span>
          </div>
          {invitableAgents.length === 0 ? (
            <>
              <p className="brainstorm-panel__hint">{t('tabs.brainstormEmptyCatalog')}</p>
              {onCreateAgent ? (
                <Button variant="primary" size="sm" onClick={onCreateAgent}>
                  {t('tabs.brainstormCreateAgent')}
                </Button>
              ) : null}
            </>
          ) : (
            invitableAgents.map(agent => {
              const at = safeParticipantIds.indexOf(agent.id)
              return (
                <BrainstormInviteSeatCard
                  key={agent.id}
                  agentId={agent.id}
                  name={brainstormCatalogAgentLabel(agent)}
                  role={roleLabelOf(agent)}
                  monogram={agent.monogram?.trim()
                    || agentMonogram(brainstormCatalogAgentLabel(agent))}
                  order={at >= 0 ? at + 1 : null}
                  provider={agent.provider}
                  model={agent.model}
                  coordination={agent.coordination}
                  /* Sin uso compartido: aquí no hay panes que compartan contexto,
                     así que ninguno se marca como tal. */
                  contexts={resolveAssignedContextChips(
                    agent.contextIds ?? [],
                    contexts,
                    NO_CONTEXT_USAGE,
                    kind => t(`tabContexts.kind_${kind}`),
                  )}
                  alsoInRooms={agentsInLiveRooms[agent.id] ?? []}
                  contextDrop={handlersFor(agent.id)}
                  contextDropActive={dropAgentId === agent.id}
                  onToggle={() => toggleAgent(agent.id)}
                />
              )
            })
          )}
        </>
      )}
    >
      <div
        className="brainstorm-start"
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canStart) {
            event.preventDefault()
            handleStart()
          }
        }}
      >
        <label className="brainstorm-start__field" data-onboarding="brainstorm-goal">
          <span className="brainstorm-start__label">{t('tabs.brainstormGoalLabel')}</span>
          {/*
            Mencionar la issue en el objetivo la añade además al material de la
            sala: convocarla sobre un ticket y tener que adjuntar su contexto
            aparte era pedir el mismo dato dos veces.
          */}
          <div className="brainstorm-start__mention-anchor">
            <TextArea
              ref={topicRef}
              value={topic}
              autoFocus
              rows={2}
              placeholder={t('tabs.brainstormTopicPlaceholder')}
              onChange={event => {
                setTopic(event.target.value)
                mention.handleChange(event.target)
              }}
              onSelect={event => mention.handleSelect(event.currentTarget)}
            />
            {mention.picker}
          </div>
          <span className="brainstorm-start__hint">{t('tabs.brainstormTopicFieldHint')}</span>
        </label>

        {/* Toda la configuración en una frase editable: ver `BrainstormSentence`. */}
        <BrainstormSentence
          agents={invitableAgents}
          participantIds={safeParticipantIds}
          onToggleAgent={toggleAgent}
          onMoveSeat={moveSeat}
          outcome={outcome}
          onOutcomeChange={setOutcome}
          maxRounds={maxRounds}
          onMaxRoundsChange={setMaxRounds}
          ceremony={ceremony}
          onCeremonyChange={handleCeremonyChange}
          cwd={cwd}
          contextIds={contextIds}
          filePaths={filePaths}
          onWorkingSetChange={next => {
            setContextIds(next.contextIds)
            setFilePaths(next.filePaths)
          }}
        />

        {/* Qué te llevas. Nada en la pantalla lo decía, así que arrancar una
            sala era un salto de fe: el acta es el motivo de convocarla. */}
        <p className="brainstorm-start__takeaway">{t('tabs.brainstormTakeaway')}</p>

        <div className="brainstorm-start__footer">
          {/* Lo que va a costar, pegado al botón que lo paga. Y si falta algo,
              se dice UNA vez y se dice todo: antes «faltan participantes» salía
              en el centro y en el pie, y el otro requisito —escribir el
              objetivo— no se avisaba en ningún lado. */}
          {missing.length ? (
            <span className="brainstorm-start__missing">
              {t('tabs.brainstormMissing', { items: missing.join(' · ') })}
            </span>
          ) : (
            <span className="brainstorm-start__cost">
              <span className="brainstorm-start__cost-cell">
                <b>{turns}</b>
                {t('tabs.brainstormEstimateTurns')}
              </span>
              <span className="brainstorm-start__cost-cell">
                <b>{brainstormRunMinutes(turns)}</b>
                {t('tabs.brainstormEstimateMinutes')}
              </span>
              <span className="brainstorm-start__cost-cell">
                <b>{materialCount}</b>
                {t('tabs.brainstormEstimateMaterial')}
              </span>
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canStart}
            data-onboarding="brainstorm-start"
            onClick={handleStart}
          >
            {t('tabs.brainstormStart')}
          </Button>
        </div>
      </div>
    </BrainstormOverlay>
  )
}
