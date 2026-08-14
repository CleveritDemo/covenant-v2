import React, { useState } from 'react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  BRAINSTORM_OUTCOMES,
  brainstormCatalogAgentLabel,
  brainstormRunMinutes,
  sanitizeBrainstormMaxRounds,
  type BrainstormOutcome,
} from '@shared/brainstormRoom'
import {
  ceremoniesByStage,
  ceremonyById,
  ceremonyRoleCoverage,
  ceremonyUsesFreeOutcome,
  CEREMONY_STAGES,
  DEFAULT_CEREMONY_ID,
  type CeremonyId,
} from '@shared/agileCeremonies'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { CEREMONY_GOAL_KEY, CEREMONY_ROLE_KEY, CEREMONY_STAGE_KEY } from './ceremonyLabels'
import { BrainstormRoundsSlider } from './BrainstormRoundsSlider'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import './BrainstormSentence.css'

/** Cuál de los cuatro cajones está abierto; solo uno a la vez. */
type Drawer = 'team' | 'outcome' | 'time' | 'material'

/** Sin anotar como `Record<_, string>`: `t` exige la clave literal. */
const OUTCOME_PHRASE_KEY = {
  ideas: 'tabs.brainstormOutcomeIdeasPhrase',
  decision: 'tabs.brainstormOutcomeDecisionPhrase',
  plan: 'tabs.brainstormOutcomePlanPhrase',
  critique: 'tabs.brainstormOutcomeCritiquePhrase',
} as const satisfies Record<BrainstormOutcome, string>

export interface BrainstormSentenceProps {
  /** Agentes invitables, en el orden del catálogo. */
  agents: ProjectAgentDefinition[]
  /** Ids sentados, en orden de habla. */
  participantIds: string[]
  onToggleAgent: (agentId: string) => void
  onMoveSeat: (from: number, to: number) => void
  outcome: BrainstormOutcome
  onOutcomeChange: (value: BrainstormOutcome) => void
  maxRounds: number
  onMaxRoundsChange: (value: number) => void
  ceremony: CeremonyId
  onCeremonyChange: (value: CeremonyId) => void
  cwd: string
  contextIds: string[]
  filePaths: string[]
  onWorkingSetChange: (next: { contextIds: string[]; filePaths: string[] }) => void
}

/**
 * La configuración de una sala escrita como una frase: «Quiero que X me den Y
 * en Z, leyendo W». Cada palabra resaltada abre su control debajo.
 *
 * El motivo no es estético. La pantalla anterior pedía cinco decisiones
 * repartidas en tres columnas antes de dejar empezar, y cuatro de ellas ya
 * tenían una respuesta razonable; para quien viene de negocio eso no se lee
 * como potencia, se lee como formulario. Aquí la frase ya viene respondida y se
 * puede arrancar sin tocarla — pero nada está escondido: se ve lo que va a
 * pasar antes de que pase.
 *
 * Las once ceremonias no desaparecen: viven dentro del cajón de la salida, que
 * es la decisión que reemplazan. Elegir una reescribe la frase entera (salida y
 * duración incluidas) en vez de mover el slider a espaldas del usuario.
 */
export const BrainstormSentence: React.FC<BrainstormSentenceProps> = ({
  agents,
  participantIds,
  onToggleAgent,
  onMoveSeat,
  outcome,
  onOutcomeChange,
  maxRounds,
  onMaxRoundsChange,
  ceremony,
  onCeremonyChange,
  cwd,
  contextIds,
  filePaths,
  onWorkingSetChange,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState<Drawer | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const isFree = ceremonyUsesFreeOutcome(ceremony)
  const rounds = sanitizeBrainstormMaxRounds(maxRounds)
  const minutes = brainstormRunMinutes(Math.max(1, participantIds.length) * rounds)
  const materialCount = contextIds.length + filePaths.length

  const seated = participantIds
    .map(id => agents.find(agent => agent.id === id))
    .filter((agent): agent is ProjectAgentDefinition => Boolean(agent))

  /**
   * Sentados primero y en orden de habla; el resto detrás, en el del catálogo.
   * Si la lista fuera siempre la del catálogo, arrastrar solo cambiaría los
   * números y el reordenar no se vería mover nada.
   */
  const roster = [
    ...seated,
    ...agents.filter(agent => !participantIds.includes(agent.id)),
  ]

  // Sin ceremonia (`free`) esto viene vacío y el cajón se queda solo con la gente.
  const seats = ceremonyRoleCoverage(ceremony, seated)
  const covered = seats.filter(seat => seat.agentId).length

  const teamText = seated.length
    ? seated.map(brainstormCatalogAgentLabel).join(', ')
    : t('tabs.brainstormSentenceWho')
  // Con ceremonia la salida ya está fijada por la plantilla: el token la nombra.
  const outcomeText = isFree
    ? t(OUTCOME_PHRASE_KEY[outcome])
    : ceremonyById(ceremony).name
  const materialText = materialCount === 0
    ? t('tabs.brainstormSentenceNoMaterial')
    : t('tabs.brainstormSentenceMaterialCount', { count: String(materialCount) })

  const toggle = (drawer: Drawer): void => setOpen(current => (
    current === drawer ? null : drawer
  ))

  const token = (drawer: Drawer, text: string, empty = false): React.ReactNode => (
    <button
      type="button"
      className={['brainstorm-sentence__tok', empty ? 'brainstorm-sentence__tok--todo' : '']
        .filter(Boolean).join(' ')}
      aria-expanded={open === drawer}
      onClick={() => toggle(drawer)}
    >
      {text}
    </button>
  )

  return (
    <div className="brainstorm-sentence">
      <p className="brainstorm-sentence__line">
        {t('tabs.brainstormSentenceLead')}
        {' '}
        {/* En gris también cuando la plantilla pide roles que nadie cubre: el
            aviso vive dentro del cajón y si no, no se vería hasta abrirlo. */}
        {token('team', teamText, seated.length < 2 || covered < seats.length)}
        {' '}
        {t('tabs.brainstormSentenceGive')}
        {' '}
        {token('outcome', outcomeText)}
        {' '}
        {t('tabs.brainstormSentenceIn')}
        {' '}
        {token('time', t('tabs.brainstormSentenceMinutes', { min: String(minutes) }))}
        {', '}
        {t('tabs.brainstormSentenceReading')}
        {' '}
        {token('material', materialText, materialCount === 0)}
        .
      </p>

      {open === 'team' ? (
        <div className="brainstorm-sentence__drawer">
          <span className="brainstorm-sentence__drawer-label">
            {t('tabs.brainstormOrderDragHint')}
          </span>
          {agents.length === 0 ? (
            <p className="brainstorm-sentence__hint">{t('tabs.brainstormEmptyCatalog')}</p>
          ) : (
            <div className="brainstorm-sentence__opts">
              {roster.map(agent => {
                const at = participantIds.indexOf(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className="brainstorm-sentence__opt"
                    aria-pressed={at >= 0}
                    style={{
                      '--brainstorm-seat-color': paletteColorForSeed(agent.id),
                    } as React.CSSProperties}
                    /* Arrastrar reordena el turno de habla, igual que en la
                       lista que esto reemplaza. Solo tiene sentido sentado. */
                    draggable={at >= 0}
                    onDragStart={() => setDragFrom(at)}
                    onDragEnd={() => setDragFrom(null)}
                    onDragOver={event => {
                      if (dragFrom === null || at < 0) return
                      event.preventDefault()
                    }}
                    onDrop={event => {
                      if (dragFrom === null || at < 0) return
                      event.preventDefault()
                      onMoveSeat(dragFrom, at)
                      setDragFrom(null)
                    }}
                    onClick={() => onToggleAgent(agent.id)}
                  >
                    {at >= 0 ? (
                      <span className="brainstorm-sentence__seat">{at + 1}</span>
                    ) : null}
                    {brainstormCatalogAgentLabel(agent)}
                  </button>
                )
              })}
            </div>
          )}
          {/* Los roles que pide la plantilla, con su hueco a la vista. Van aquí
              y no sueltos bajo la frase: son la misma decisión —quién se
              sienta— vista desde lo que la ceremonia exige. */}
          {seats.length ? (
            <>
              <ul className="brainstorm-sentence__seats">
                {seats.map(seat => {
                  const seatAgent = seated.find(item => item.id === seat.agentId)
                  return (
                    <li
                      key={seat.role}
                      className={[
                        'brainstorm-sentence__seat',
                        seat.agentId ? '' : 'brainstorm-sentence__seat--open',
                        // `guess` se dedujo del texto libre y puede fallar;
                        // `double` ya tiene otro asiento. Ambos: sin confirmar.
                        seat.via === 'guess' || seat.via === 'double'
                          ? 'brainstorm-sentence__seat--unsure'
                          : '',
                      ].filter(Boolean).join(' ')}
                      style={seat.agentId
                        ? {
                          '--brainstorm-seat-color': paletteColorForSeed(seat.agentId),
                        } as React.CSSProperties
                        : undefined}
                    >
                      <span className="brainstorm-sentence__seat-role">
                        {t(CEREMONY_ROLE_KEY[seat.role])}
                      </span>
                      <span className="brainstorm-sentence__seat-agent">
                        {seat.agentId
                          ? (seatAgent?.name?.trim() || seat.agentId)
                          : t('tabs.ceremonyRoleMissing')}
                      </span>
                      {seat.via === 'guess' || seat.via === 'double' ? (
                        <span className="brainstorm-sentence__seat-unsure">
                          {t(seat.via === 'double'
                            ? 'tabs.ceremonyRoleDouble'
                            : 'tabs.ceremonyRoleGuessed')}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              <span className="brainstorm-sentence__hint">
                {covered === seats.length
                  ? t('tabs.ceremonyRolesCovered', {
                    covered: String(covered),
                    total: String(seats.length),
                  })
                  : t('tabs.ceremonyRolesPartial', {
                    covered: String(covered),
                    total: String(seats.length),
                  })}
              </span>
            </>
          ) : (
            <span className="brainstorm-sentence__hint">
              {t('tabs.brainstormStartNeedTwo')}
            </span>
          )}
        </div>
      ) : null}

      {open === 'outcome' ? (
        <div className="brainstorm-sentence__drawer">
          <span className="brainstorm-sentence__drawer-label">
            {t('tabs.brainstormOutcomeLabel')}
          </span>
          <div className="brainstorm-sentence__opts">
            {BRAINSTORM_OUTCOMES.map(value => (
              <button
                key={value}
                type="button"
                className="brainstorm-sentence__opt"
                aria-pressed={isFree && value === outcome}
                onClick={() => {
                  // Volver a la conversación abierta: elegir una salida a mano
                  // es justo lo que una ceremonia deja de permitir.
                  if (!isFree) onCeremonyChange(DEFAULT_CEREMONY_ID)
                  onOutcomeChange(value)
                }}
              >
                {t(OUTCOME_PHRASE_KEY[value])}
              </button>
            ))}
          </div>

          {/* Las plantillas viven aquí, dentro de la decisión que reemplazan:
              eran ocho nombres de manual ocupando lo primero de la pantalla. */}
          <span className="brainstorm-sentence__drawer-label">
            {t('tabs.brainstormFormatLabel')}
          </span>
          <div className="brainstorm-sentence__templates">
            {CEREMONY_STAGES.map(stage => (
              <React.Fragment key={stage}>
                <span className="brainstorm-sentence__stage">
                  {t(CEREMONY_STAGE_KEY[stage])}
                </span>
                {ceremoniesByStage(stage).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="brainstorm-sentence__template"
                    aria-pressed={item.id === ceremony}
                    onClick={() => onCeremonyChange(item.id)}
                  >
                    <span className="brainstorm-sentence__template-name">{item.name}</span>
                    <span className="brainstorm-sentence__template-meta">
                      {t('tabs.brainstormRoundsDigest', { count: String(item.rounds) })}
                    </span>
                    {/* Para qué sirve, no cómo se llama: el nombre de manual no
                        le dice nada a quien viene de negocio. */}
                    <span className="brainstorm-sentence__template-for">
                      {t(CEREMONY_GOAL_KEY[item.id])}
                    </span>
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}

      {open === 'time' ? (
        <div className="brainstorm-sentence__drawer">
          <span className="brainstorm-sentence__drawer-label">
            {t('tabs.brainstormDurationLabel')}
          </span>
          <BrainstormRoundsSlider
            value={maxRounds}
            onChange={onMaxRoundsChange}
            participantCount={participantIds.length}
          />
          <span className="brainstorm-sentence__hint">
            {t('tabs.brainstormDurationHint')}
          </span>
        </div>
      ) : null}

      {open === 'material' ? (
        <div className="brainstorm-sentence__drawer">
          <span className="brainstorm-sentence__drawer-label">
            {t('tabs.brainstormMaterialLabel')}
          </span>
          <BrainstormWorkingSetField
            cwd={cwd}
            contextIds={contextIds}
            filePaths={filePaths}
            onChange={onWorkingSetChange}
          />
          <span className="brainstorm-sentence__hint">
            {t('tabs.brainstormMaterialHint')}
          </span>
        </div>
      ) : null}
    </div>
  )
}
