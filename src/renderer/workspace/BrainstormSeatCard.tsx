import React from 'react'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import type { BrainstormSeatState } from '@shared/brainstormRoom'
import type { AgentCliProvider } from '@shared/tabSession'
import { useT } from '@i18n/useT'
import { Tooltip } from '../components/ui/Tooltip'
import { PlaneMiniFace } from './PlaneMiniFace'
import { PlaneAgentContextNodes, type PlaneAgentContextChip } from './PlaneAgentContextNodes'

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
  /**
   * Contextos del agente ya resueltos: los mismos chips que la mini del plano,
   * con su icono y su color, no una lista de nombres.
   */
  contexts?: PlaneAgentContextChip[]
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  onToggle: () => void
}

export interface BrainstormLiveSeatCardProps extends BrainstormSeatCardProps {
  /** Contextos del agente, ya resueltos: lo que trae leído a la sala. */
  contexts?: PlaneAgentContextChip[]
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator' | 'productOwner'
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
 * Tarjeta de invitación: se pulsa para sentar y la cápsula dice en qué turno
 * habla. El orden es la única razón por la que estas tarjetas se reordenan.
 *
 * Es la MISMA cara que la mini del plano (`PlaneMiniFace` + sus contextos), no
 * una tarjeta parecida: al agente se le reconoce igual aquí que allí. Lo único
 * que se añade alrededor es lo que el plano no necesita saber —el turno de
 * habla y si ya tiene asiento en otra sala.
 *
 * `div role="button"` en vez de `<button>`: dentro van la lista de contextos y
 * sus chips, que son botones, y un botón no puede contener otro.
 */
export const BrainstormInviteSeatCard: React.FC<BrainstormInviteSeatCardProps> = ({
  agentId,
  name,
  role,
  monogram,
  order,
  contexts = [],
  provider,
  coordination,
  alsoInRooms = [],
  onToggle,
}) => {
  const { t } = useT()
  const seated = order !== null
  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'brainstorm-seat',
        'brainstorm-seat--invite',
        seated ? 'brainstorm-seat--seated' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--brainstorm-seat-color': paletteColorForSeed(agentId) } as React.CSSProperties}
      aria-pressed={seated}
      onClick={onToggle}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onToggle()
      }}
    >
      {/* Sin asa de arrastre: la tarjeta no se arrastra —el orden se reordena en
          los chips del centro— y la mesa a la que se arrastraba ya no existe.
          Sin medalla de orden tampoco: el turno lo dice la cápsula de estado, y
          un número flotando en la esquina se comía el nombre cuando era largo. */}
      <PlaneMiniFace
        name={name}
        monogram={monogram}
        provider={provider}
        coordination={coordination}
        statusLabel={seated
          ? t('tabs.brainstormSeatTurn', { order: String(order) })
          : t('tabs.brainstormSeatFree')}
      >
        {role ? <span className="brainstorm-seat__role">{role}</span> : null}
        <AlsoTag
          rooms={alsoInRooms}
          prefix={t('tabs.brainstormSeatAlsoShort')}
          title={t('tabs.brainstormSeatAlsoTitle')}
        />
        {/* Pulsar un contexto es pulsar el agente, como en el plano. */}
        <PlaneAgentContextNodes contexts={contexts} onOpenAgent={onToggle} />
      </PlaneMiniFace>
    </div>
  )
}

/**
 * Tarjeta en vivo: quién habla, cuántos turnos lleva y la última línea que
 * dijo. Se pulsa para abrir su pane —solo sus turnos— igual que abrir un
 * agente en el plano de codificación.
 *
 * Misma cara que el asiento de invitación y que la mini del plano: el agente se
 * reconoce igual en las tres vistas. Lo propio de la sala viva va debajo, en el
 * hueco de los contextos: el estado con su contador de turnos y la cola de lo
 * último que dijo.
 */
export const BrainstormLiveSeatCard: React.FC<BrainstormLiveSeatCardProps> = ({
  agentId,
  name,
  role,
  monogram,
  contexts = [],
  provider,
  coordination,
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
      <div
        role="button"
        tabIndex={0}
        className={[
          'brainstorm-seat',
          'brainstorm-seat--live',
          `brainstorm-seat--${state}`,
        ].join(' ')}
        style={{ '--brainstorm-seat-color': paletteColorForSeed(agentId) } as React.CSSProperties}
        onClick={onOpen}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpen()
        }}
      >
        {/* El contador va dentro del estado: «hablando · 2/4» es una sola cosa
            —cómo va este asiento— y no dos esquinas que leer por separado. Y
            mientras habla, el punto de trabajo del plano hace de spinner. */}
        <PlaneMiniFace
          name={name}
          monogram={monogram}
          provider={provider}
          coordination={coordination}
          busy={state === 'speaking'}
          statusLabel={`${stateLabel} · ${turnsDone}/${rounds}`}
        >
          {role ? <span className="brainstorm-seat__role">{role}</span> : null}
          <AlsoTag
            rooms={alsoInRooms}
            prefix={t('tabs.brainstormSeatAlsoShort')}
            title={t('tabs.brainstormSeatAlsoTitle')}
          />
          <PlaneAgentContextNodes contexts={contexts} onOpenAgent={onOpen} />
          {/*
            La línea es la cola del último turno, literal: sale de lo que ya
            está en `brainstormLiveState` y no pide un campo nuevo al protocolo
            de cierre. A veces corta a media frase — es rastro de dónde quedó.
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
        </PlaneMiniFace>
      </div>
    </Tooltip>
  )
}
