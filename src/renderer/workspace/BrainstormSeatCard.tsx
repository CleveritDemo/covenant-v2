import React from 'react'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import type { BrainstormSeatState } from '@shared/brainstormRoom'
import { useT } from '@i18n/useT'
import { Spinner } from '../components/ui/Spinner'
import { Tooltip } from '../components/ui/Tooltip'

export interface BrainstormSeatCardProps {
  agentId: string
  name: string
  role?: string
  /**
   * Monograma de la ficha (Vanesa → «QA»), como en las minis del plano: el
   * agente se reconoce por sus dos letras antes que por el nombre completo.
   */
  monogram?: string
  /** Salas vivas donde este agente ya tiene asiento (temas, para nombrarlas). */
  alsoInRooms?: readonly string[]
}

export interface BrainstormInviteSeatCardProps extends BrainstormSeatCardProps {
  /** Posición en el orden de habla, 1-based. null si no está sentado. */
  order: number | null
  /** Contextos del agente: lo que ya trae puesto a la mesa. */
  contexts?: readonly string[]
  onToggle: () => void
}

export interface BrainstormLiveSeatCardProps extends BrainstormSeatCardProps {
  state: BrainstormSeatState
  /** Puesto en la cola de turnos, 1-based. Solo cuando espera. */
  queuePosition?: number
  turnsDone: number
  rounds: number
  /** Última línea del último turno, tal cual. Vacío si aún no ha hablado. */
  tail?: string
  /** Escribiendo ahora: la línea es la cola del stream, no un turno cerrado. */
  live?: boolean
  onOpen: () => void
}

/** «in Retro», «also Retro»: el mismo agente puede estar en varias salas. */
const AlsoTag: React.FC<{
  rooms: readonly string[]
  prefix: string
  title: string
}> = ({ rooms, prefix, title }) => {
  if (!rooms.length) return null
  return (
    <Tooltip content={title}>
      <span className="brainstorm-seat__also">
        {prefix}
        {' '}
        {rooms.length === 1 ? rooms[0] : rooms.length}
      </span>
    </Tooltip>
  )
}

/**
 * Tarjeta de invitación: se pulsa para sentar y el número dice en qué turno
 * habla. El orden es la única razón por la que estas tarjetas se reordenan.
 */
export const BrainstormInviteSeatCard: React.FC<BrainstormInviteSeatCardProps> = ({
  agentId,
  name,
  role,
  monogram,
  order,
  contexts = [],
  alsoInRooms = [],
  onToggle,
}) => {
  const { t } = useT()
  const seated = order !== null
  return (
    <button
      type="button"
      className={[
        'brainstorm-seat',
        'brainstorm-seat--invite',
        seated ? 'brainstorm-seat--seated' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--brainstorm-seat-color': paletteColorForSeed(agentId) } as React.CSSProperties}
      aria-pressed={seated}
      onClick={onToggle}
    >
      {seated ? (
        <span className="brainstorm-seat__order" aria-hidden>{order}</span>
      ) : null}
      {/* Sin asa de arrastre: la tarjeta no se arrastra —el orden se reordena en
          los chips del centro— y la mesa a la que se arrastraba ya no existe. */}
      <span className="brainstorm-seat__row">
        {monogram ? (
          <span className="brainstorm-seat__monogram">{monogram}</span>
        ) : null}
        <span className="brainstorm-seat__name">{name}</span>
      </span>
      <span className="brainstorm-seat__row brainstorm-seat__row--meta">
        {role ? <span className="brainstorm-seat__role">{role}</span> : null}
        <AlsoTag
          rooms={alsoInRooms}
          prefix={t('tabs.brainstormSeatAlsoShort')}
          title={t('tabs.brainstormSeatAlsoTitle')}
        />
      </span>
      {contexts.length ? (
        <span className="brainstorm-seat__tail">{contexts.join(' · ')}</span>
      ) : null}
    </button>
  )
}

/**
 * Tarjeta en vivo: quién habla, cuántos turnos lleva y la última línea que
 * dijo. Se pulsa para abrir su pane —solo sus turnos— igual que abrir un
 * agente en el plano de codificación.
 */
export const BrainstormLiveSeatCard: React.FC<BrainstormLiveSeatCardProps> = ({
  agentId,
  name,
  role,
  monogram,
  state,
  queuePosition,
  turnsDone,
  rounds,
  tail,
  live = false,
  alsoInRooms = [],
  onOpen,
}) => {
  const { t } = useT()
  const stateLabel = state === 'speaking'
    ? t('tabs.brainstormSeatSpeaking')
    : state === 'spoke'
      ? t('tabs.brainstormSeatSpoke')
      : queuePosition
        ? t('tabs.brainstormSeatQueued', { position: String(queuePosition) })
        : t('tabs.brainstormSeatWaiting')

  return (
    <Tooltip content={t('tabs.brainstormSeatOpenPane', { name })}>
      <button
        type="button"
        className={[
          'brainstorm-seat',
          'brainstorm-seat--live',
          `brainstorm-seat--${state}`,
        ].join(' ')}
        style={{ '--brainstorm-seat-color': paletteColorForSeed(agentId) } as React.CSSProperties}
        onClick={onOpen}
      >
        <span className="brainstorm-seat__row">
          {monogram ? (
            <span className="brainstorm-seat__monogram">{monogram}</span>
          ) : null}
          <span className="brainstorm-seat__name">{name}</span>
          <span className="brainstorm-seat__turns">{turnsDone}/{rounds}</span>
        </span>
        <span className="brainstorm-seat__row brainstorm-seat__row--meta">
          <span className="brainstorm-seat__state">
            {/* Mismo spinner que el resto de la app mientras un agente trabaja:
                el chip decía «hablando» pero nada se movía. */}
            {state === 'speaking' ? (
              <Spinner aria-label={stateLabel} />
            ) : null}
            {stateLabel}
          </span>
          <AlsoTag
            rooms={alsoInRooms}
            prefix={t('tabs.brainstormSeatAlsoShort')}
            title={t('tabs.brainstormSeatAlsoTitle')}
          />
        </span>
        {role ? <span className="brainstorm-seat__role">{role}</span> : null}
        {/*
          La línea es la cola del último turno, literal: sale de lo que ya está
          en `brainstormLiveState` y no pide un campo nuevo al protocolo de
          cierre. A veces corta a media frase — es rastro de dónde quedó.
        */}
        <span className="brainstorm-seat__tail">
          {tail
            ? (
              <>
                {tail}
                {live ? <i className="brainstorm-seat__caret" aria-hidden /> : null}
              </>
            )
            : <em className="brainstorm-seat__silent">{t('tabs.brainstormSeatSilent')}</em>}
        </span>
      </button>
    </Tooltip>
  )
}
