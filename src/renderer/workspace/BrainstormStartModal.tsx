import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_OUTCOMES,
  brainstormCatalogAgentLabel,
  filterBrainstormInvitableAgents,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import {
  candidateCeremonyRoles,
  ceremoniesByStage,
  ceremonyById,
  ceremonyRoleCoverage,
  ceremonyUsesFreeOutcome,
  CEREMONY_STAGES,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
} from '@shared/agileCeremonies'
import { agentMonogram, paletteColorForSeed } from '@shared/tabContextAppearance'
import { brainstormContextLabel } from '@shared/brainstormContextLabel'
import { useT } from '@i18n/useT'
import {
  CEREMONY_GOAL_KEY,
  CEREMONY_ROLE_KEY,
  CEREMONY_STAGE_KEY,
} from './ceremonyLabels'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { useJiraMention } from './useJiraMention'
import { Button, SegmentedControl, Select, TextArea } from '../components/ui'
import { BrainstormOverlay } from './BrainstormOverlay'
import { BrainstormModuleTabs } from './BrainstormModuleTabs'
import { BrainstormInviteSeatCard } from './BrainstormSeatCard'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import { MINUTES_PER_TURN, brainstormRoundOptions } from './BrainstormBriefFields'
import { tryCreateBrainstormSession } from './brainstormUiGuards'
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
  /** Actas guardadas: el número va en la pestaña de la biblioteca. */
  savedRoomsCount?: number
  onClose: () => void
  /** Volver a la biblioteca, que es la otra pestaña del módulo. */
  onOpenRooms?: () => void
  onStarted: (room: BrainstormRoom) => void
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
  savedRoomsCount = 0,
  onClose,
  onOpenRooms,
  onStarted,
}) => {
  const { t } = useT()
  const [topic, setTopic] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [ceremony, setCeremony] = useState<CeremonyId>(DEFAULT_CEREMONY_ID)
  const [maxRounds, setMaxRounds] = useState(ceremonyById(DEFAULT_CEREMONY_ID).rounds)
  const [contextIds, setContextIds] = useState<string[]>([])
  const topicRef = useRef<HTMLTextAreaElement>(null)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [outcome, setOutcome] = useState<BrainstormOutcome>('ideas')

  useEffect(() => {
    if (!open) return
    setTopic('')
    setParticipantIds([])
    setCeremony(DEFAULT_CEREMONY_ID)
    setMaxRounds(ceremonyById(DEFAULT_CEREMONY_ID).rounds)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
  }, [open])

  const invitableAgents = useMemo(
    () => filterBrainstormInvitableAgents(agents),
    [agents],
  )

  const safeParticipantIds = useMemo(
    () => sanitizeBrainstormInviteIds(participantIds, agents),
    [participantIds, agents],
  )

  const seatedAgents = useMemo(
    () => safeParticipantIds
      .map(id => agents.find(agent => agent.id === id))
      .filter((agent): agent is ProjectAgentDefinition => Boolean(agent)),
    [safeParticipantIds, agents],
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
   * Reordenar el orden de habla arrastrando, como se reordenan los agentes del
   * plano. El orden aquí no es cosmético: es el turno en que habla cada uno.
   */
  const [dragFrom, setDragFrom] = useState<number | null>(null)

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

  const outcomeLabels: Record<BrainstormOutcome, string> = {
    ideas: t('tabs.brainstormOutcomeIdeas'),
    decision: t('tabs.brainstormOutcomeDecision'),
    plan: t('tabs.brainstormOutcomePlan'),
    critique: t('tabs.brainstormOutcomeCritique'),
  }

  const ceremonyDef = ceremonyById(ceremony)
  const isFree = ceremonyUsesFreeOutcome(ceremony)
  /**
   * La issue elegida entra en el material de la sala además de escribirse en el
   * objetivo: la sala arranca con el ticket adjunto, sin pegarlo a mano.
   */
  const attachIssue = useCallback((issue: JiraIssueRef): void => {
    const context = jiraDraftFromKey(issue.key)
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

  const mention = useJiraMention({
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

  const seats = ceremonyRoleCoverage(ceremony, seatedAgents)
  const coveredSeats = seats.filter(seat => seat.agentId).length

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
      chrome={(
        <BrainstormModuleTabs
          tab="new"
          roomsCount={savedRoomsCount}
          onRooms={() => onOpenRooms?.()}
          onNew={() => {}}
        />
      )}
      left={(
        <>
          {/* Formato: las once ceremonias a la vista, agrupadas por etapa del
              pipeline, que es lo que decide la elección. Antes vivían tras un
              desplegable porque el modal no daba para más. */}
          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormFormatLabel')}
            </span>
            <div className="brainstorm-format-list">
              {CEREMONY_STAGES.map(stage => (
                <React.Fragment key={stage}>
                  <span className="brainstorm-format-list__stage">
                    {t(CEREMONY_STAGE_KEY[stage])}
                  </span>
                  {ceremoniesByStage(stage).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={[
                        'brainstorm-format-list__item',
                        item.id === ceremony ? 'brainstorm-format-list__item--on' : '',
                      ].filter(Boolean).join(' ')}
                      aria-pressed={item.id === ceremony}
                      onClick={() => handleCeremonyChange(item.id)}
                    >
                      <span className="brainstorm-format-list__name">{item.name}</span>
                      <span className="brainstorm-format-list__rounds">
                        {t('tabs.brainstormRoundsDigest', { count: String(item.rounds) })}
                      </span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <span className="brainstorm-panel__hint">
              {t(CEREMONY_GOAL_KEY[ceremonyDef.id])}
            </span>
          </section>

          {/* Con formato la salida ya está fijada: elegirla a mano sobraría. */}
          {isFree ? (
            <section className="brainstorm-panel">
              <span className="brainstorm-panel__title">
                {t('tabs.brainstormOutcomeLabel')}
              </span>
              <SegmentedControl
                size="sm"
                label={t('tabs.brainstormOutcomeLabel')}
                value={outcome}
                onChange={setOutcome}
                options={BRAINSTORM_OUTCOMES.map(value => ({
                  value,
                  label: outcomeLabels[value],
                }))}
              />
            </section>
          ) : null}

          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormDurationLabel')}
            </span>
            <Select
              size="sm"
              value={String(maxRounds)}
              onChange={next => setMaxRounds(sanitizeBrainstormMaxRounds(Number(next)))}
              options={brainstormRoundOptions(t)}
            />
            <span className="brainstorm-panel__hint">
              {t('tabs.brainstormDurationHint')}
            </span>
          </section>

          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormMaterialLabel')}
            </span>
            <BrainstormWorkingSetField
              cwd={cwd}
              contextIds={contextIds}
              filePaths={filePaths}
              onChange={next => {
                setContextIds(next.contextIds)
                setFilePaths(next.filePaths)
              }}
            />
            <span className="brainstorm-panel__hint">
              {t('tabs.brainstormMaterialHint')}
            </span>
          </section>

          {/* Lo que va a costar, antes de arrancar: el pie solo lo decía en una
              frase y se leía como relleno. */}
          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormEstimateLabel')}
            </span>
            <div className="brainstorm-estimate">
              <span className="brainstorm-estimate__cell">
                <b>{turns}</b>
                <span>{t('tabs.brainstormEstimateTurns')}</span>
              </span>
              <span className="brainstorm-estimate__cell">
                <b>{Math.max(1, Math.round(turns * MINUTES_PER_TURN))}</b>
                <span>{t('tabs.brainstormEstimateMinutes')}</span>
              </span>
              <span className="brainstorm-estimate__cell">
                <b>{materialCount}</b>
                <span>{t('tabs.brainstormEstimateMaterial')}</span>
              </span>
            </div>
          </section>
        </>
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
            <p className="brainstorm-panel__hint">{t('tabs.brainstormEmptyCatalog')}</p>
          ) : invitableAgents.map(agent => {
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
                /* Los ids crudos (`iaterminal:notes:Front-Rules`) no dicen nada:
                   la mini del plano muestra el nombre y aquí igual. */
                contexts={(agent.contextIds ?? [])
                  .map(id => brainstormContextLabel(id).label)}
                alsoInRooms={agentsInLiveRooms[agent.id] ?? []}
                onToggle={() => toggleAgent(agent.id)}
              />
            )
          })}
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
        <label className="brainstorm-start__field">
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

        <div className="brainstorm-start__body">
          <span className="brainstorm-start__label">
            {t('tabs.brainstormOrderDragHint')}
          </span>
          {/* El orden de las tarjetas es el orden de habla: aquí se lee sin
              tener que recorrer la columna contando números. */}
          <ol className="brainstorm-start__order">
            {seatedAgents.map((agent, index) => (
              <li
                key={agent.id}
                className={[
                  'brainstorm-start__order-item',
                  dragFrom === index ? 'brainstorm-start__order-item--dragging' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  '--brainstorm-seat-color': paletteColorForSeed(agent.id),
                } as React.CSSProperties}
                draggable
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={event => {
                  // Sin `preventDefault` el navegador no acepta la soltada.
                  if (dragFrom === null) return
                  event.preventDefault()
                }}
                onDrop={event => {
                  if (dragFrom === null) return
                  event.preventDefault()
                  moveSeat(dragFrom, index)
                  setDragFrom(null)
                }}
              >
                <span className="brainstorm-start__order-index">{index + 1}</span>
                {brainstormCatalogAgentLabel(agent)}
              </li>
            ))}
            {seatedAgents.length === 0 ? (
              <li className="brainstorm-start__hint">
                {t('tabs.brainstormStartNeedTwo')}
              </li>
            ) : null}
          </ol>

          {/* Los roles que pide la ceremonia, con su hueco a la vista: el
              conteo solo decía cuántos faltaban, no cuáles. */}
          {isFree || !seats.length ? null : (
            <ul className="brainstorm-start__seats">
              {seats.map(seat => {
                const seatAgent = seatedAgents.find(item => item.id === seat.agentId)
                return (
                  <li
                    key={seat.role}
                    className={[
                      'brainstorm-start__seat',
                      seat.agentId ? '' : 'brainstorm-start__seat--missing',
                      seat.via === 'guess' ? 'brainstorm-start__seat--guess' : '',
                      seat.via === 'double' ? 'brainstorm-start__seat--double' : '',
                    ].filter(Boolean).join(' ')}
                    style={seat.agentId
                      ? {
                        '--brainstorm-seat-color': paletteColorForSeed(seat.agentId),
                      } as React.CSSProperties
                      : undefined}
                  >
                    <span className="brainstorm-start__seat-role">
                      {t(CEREMONY_ROLE_KEY[seat.role])}
                    </span>
                    <span className="brainstorm-start__seat-agent">
                      {seat.agentId
                        ? (seatAgent?.name?.trim() || seat.agentId)
                        : t('tabs.ceremonyRoleMissing')}
                    </span>
                    {/* `guess` se dedujo del texto libre y puede fallar;
                        `double` es alguien que ya tiene asiento y además
                        cubre este. Los dos son «no confirmado». */}
                    {seat.via === 'guess' || seat.via === 'double' ? (
                      <span className="brainstorm-start__seat-guess">
                        {t(seat.via === 'double'
                          ? 'tabs.ceremonyRoleDouble'
                          : 'tabs.ceremonyRoleGuessed')}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {isFree || !seats.length ? null : (
            <span className="brainstorm-start__hint">
              {coveredSeats === seats.length
                ? t('tabs.ceremonyRolesCovered', {
                  covered: String(coveredSeats),
                  total: String(seats.length),
                })
                : t('tabs.ceremonyRolesPartial', {
                  covered: String(coveredSeats),
                  total: String(seats.length),
                })}
            </span>
          )}
        </div>

        <div className="brainstorm-start__footer">
          <span className="brainstorm-start__summary">
            {safeParticipantIds.length < 2
              ? t('tabs.brainstormStartNeedTwo')
              : t('tabs.brainstormRunSummary', {
                turns: String(turns),
                contexts: String(materialCount),
                minutes: String(Math.max(1, Math.round(turns * MINUTES_PER_TURN))),
              })}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
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
      </div>
    </BrainstormOverlay>
  )
}
