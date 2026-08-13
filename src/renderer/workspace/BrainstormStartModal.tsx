import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_OUTCOMES,
  isBrainstormInvitableAgent,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
  type BrainstormRoom,
} from '@shared/brainstormRoom'
import {
  ceremonyById,
  ceremonyRoleCoverage,
  ceremonyUsesFreeOutcome,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
} from '@shared/agileCeremonies'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { CEREMONY_ROLE_KEY } from './ceremonyLabels'
import { TerminalModal } from '../components/TerminalModal'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { useJiraMention } from './useJiraMention'
import { Button, SegmentedControl, Select, TextArea } from '../components/ui'
import { BrainstormInviteGrid } from './BrainstormInviteGrid'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import { CeremonyPicker } from './CeremonyPicker'
import { MINUTES_PER_TURN, brainstormRoundOptions } from './BrainstormBriefFields'
import { tryCreateBrainstormSession } from './brainstormUiGuards'
import './BrainstormStartModal.css'

export interface BrainstormStartModalProps {
  open: boolean
  active?: boolean
  cwd: string
  agents: ProjectAgentDefinition[]
  /**
   * Invitados que ya vienen sentados de la mesa del plano, si se pasó por ella.
   * Vacío en el camino normal: aquí se eligen.
   */
  initialParticipantIds?: readonly string[]
  onClose: () => void
  /** Salas guardadas del proyecto; el botón del plano ya no las abre. */
  onOpenRooms?: () => void
  onStarted: (room: BrainstormRoom) => void
}

/**
 * Arranque de una sala en una sola pantalla: objetivo, quiénes participan y un
 * desplegable con formato, material y duración.
 *
 * Sustituye al recorrido de tres superficies (ceremonia → mesa → brief). El
 * orden importa: el objetivo va primero porque es lo único que el usuario sabe
 * de entrada y lo único sin un valor por defecto razonable. El formato —que
 * antes era el paso 1— cae a `free` y se cambia solo si hace falta.
 */
export const BrainstormStartModal: React.FC<BrainstormStartModalProps> = ({
  open,
  active = true,
  cwd,
  agents,
  initialParticipantIds = [],
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
  /** Cuántas salas guardadas hay: sin el número, el botón no invita a mirar. */
  const [savedCount, setSavedCount] = useState(0)
  /**
   * Los ajustes desplegados ensanchan el modal en vez de estirarlo hacia abajo:
   * a lo alto obligaban a scrollear el formulario entero para volver a Empezar.
   */
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTopic('')
    setParticipantIds([...initialParticipantIds])
    setCeremony(DEFAULT_CEREMONY_ID)
    setMaxRounds(ceremonyById(DEFAULT_CEREMONY_ID).rounds)
    setContextIds([])
    setFilePaths([])
    setOutcome('ideas')
    setAdvancedOpen(false)
    // `initialParticipantIds` es un array nuevo en cada render del padre: si
    // entrara en las deps, el formulario se reiniciaría mientras se escribe.
  }, [open])

  useEffect(() => {
    const root = cwd.trim()
    if (!open || !root || !onOpenRooms) return
    let cancelled = false
    void window.api.listBrainstorms(root)
      .then(rooms => { if (!cancelled) setSavedCount(rooms.length) })
      .catch(() => { if (!cancelled) setSavedCount(0) })
    return () => { cancelled = true }
  }, [open, cwd, onOpenRooms])

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

  const digest = [
    ceremonyDef.name,
    t('tabs.brainstormRoundsDigest', { count: String(maxRounds) }),
    materialCount
      ? t('tabs.brainstormMaterialSome', { count: String(materialCount) })
      : t('tabs.brainstormMaterialNone'),
  ].join(' · ')

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onClose}
      title={t('tabs.brainstormStartTitle')}
      size={advancedOpen ? 'xl' : 'lg'}
      zIndex={850}
      footer={(
        <div className="brainstorm-start__footer">
          {/* `ghost` lo dejaba indistinguible del texto de estado de al lado:
              parecía una etiqueta y las salas guardadas se daban por perdidas. */}
          {onOpenRooms ? (
            <Button variant="secondary" size="sm" onClick={onOpenRooms}>
              {savedCount > 0
                ? t('tabs.brainstormsSavedCount', { count: String(savedCount) })
                : t('tabs.brainstormsSaved')}
            </Button>
          ) : null}
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
      )}
    >
      <div
        className={advancedOpen
          ? 'brainstorm-start brainstorm-start--expanded'
          : 'brainstorm-start'}
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
              rows={3}
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

        <div className="brainstorm-start__field">
          <span className="brainstorm-start__label">
            {t('tabs.brainstormParticipantsLabel')}
          </span>
          <BrainstormInviteGrid
            agents={agents}
            selectedIds={safeParticipantIds}
            onToggle={toggleAgent}
          />
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
          <span className="brainstorm-start__hint">
            {isFree || !seats.length
              ? t('tabs.brainstormParticipantsOrderHint')
              : coveredSeats === seats.length
                ? t('tabs.ceremonyRolesCovered', {
                  covered: String(coveredSeats),
                  total: String(seats.length),
                })
                : t('tabs.ceremonyRolesPartial', {
                  covered: String(coveredSeats),
                  total: String(seats.length),
                })}
          </span>
        </div>

        {/* Plegado por defecto: en el camino normal nadie lo abre.
            No es un `<details>`: Chromium mete su contenido en un bloque anónimo,
            así que el panel no es hijo flex del desplegable y no puede heredar
            el alto para que scrollen solo las tarjetas. */}
        <div className="brainstorm-start__more">
          <button
            type="button"
            className="brainstorm-start__more-head"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(previous => !previous)}
          >
            <span className="brainstorm-start__more-title">
              {t('tabs.brainstormAdvancedLabel')}
            </span>
            <span className="brainstorm-start__more-digest">{digest}</span>
          </button>
          {advancedOpen ? (
          <div className="brainstorm-start__more-body">
            <div className="brainstorm-start__field brainstorm-start__field--format">
              <span className="brainstorm-start__label">
                {t('tabs.brainstormFormatLabel')}
              </span>
              <CeremonyPicker value={ceremony} onChange={handleCeremonyChange} />
            </div>
            <div className="brainstorm-start__more-side">
              {/* Con formato la salida ya está fijada: elegirla a mano sobraría. */}
              {isFree ? (
                <div className="brainstorm-start__field">
                  <span className="brainstorm-start__label">
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
                </div>
              ) : null}

              <div className="brainstorm-start__field">
                <span className="brainstorm-start__label">
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
                <span className="brainstorm-start__hint">
                  {t('tabs.brainstormMaterialHint')}
                </span>
              </div>

              <label className="brainstorm-start__field">
                <span className="brainstorm-start__label">
                  {t('tabs.brainstormDurationLabel')}
                </span>
                <Select
                  size="sm"
                  value={String(maxRounds)}
                  onChange={next => setMaxRounds(sanitizeBrainstormMaxRounds(Number(next)))}
                  options={brainstormRoundOptions(t)}
                />
                <span className="brainstorm-start__hint">
                  {t('tabs.brainstormDurationHint')}
                </span>
              </label>
            </div>
          </div>
          ) : null}
        </div>
      </div>
    </TerminalModal>
  )
}
