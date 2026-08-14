/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { BrainstormStartModal } from '../BrainstormStartModal'

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const agents = [
  agent('rodrigo', 'Product Owner'),
  agent('ana', 'QA'),
  agent('nico', 'Dev'),
]

const startBrainstorm = vi.fn()

/** Sienta pulsando su tarjeta en la columna de invitados. */
function seat(name: string): void {
  const right = document.querySelector('.brainstorm-overlay__col--right') as HTMLElement
  const card = [...right.querySelectorAll('.brainstorm-seat--invite')]
    .find(node => node.textContent?.includes(name))
  fireEvent.click(card as HTMLElement)
}

function open(initial: string[] = []): void {
  render(
    <BrainstormStartModal
      open
      cwd="/repo"
      agents={agents}
      onClose={() => {}}
      onStarted={() => {}}
    />,
  )
  // El orden en que se sientan es el orden en que hablan.
  initial.forEach(seat)
}

/**
 * Abre uno de los cuatro cajones de la frase pulsando su palabra resaltada.
 * El orden en el DOM es el de la frase: quién · qué sale · cuánto · leyendo.
 */
function openToken(which: 'team' | 'outcome' | 'time' | 'material'): void {
  const order = ['team', 'outcome', 'time', 'material']
  const toks = document.querySelectorAll('.brainstorm-sentence__tok')
  fireEvent.click(toks[order.indexOf(which)] as HTMLElement)
}

function typeGoal(text: string): void {
  fireEvent.change(screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder'), {
    target: { value: text },
  })
}

beforeEach(() => {
  cleanup()
  startBrainstorm.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startBrainstorm,
    // El campo de material descubre contextos al montar.
    discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
  }
})

describe('BrainstormStartModal — todo el arranque en una pantalla', () => {
  it('con el objetivo y dos invitados ya se puede empezar, sin tocar ajustes', () => {
    open()
    typeGoal('¿Schema o row-level security?')
    seat('rodrigo')
    seat('ana')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))

    expect(startBrainstorm).toHaveBeenCalledTimes(1)
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      topic: '¿Schema o row-level security?',
      participantAgentIds: ['rodrigo', 'ana'],
      // El formato por defecto es la conversación abierta de siempre.
      ceremony: 'free',
      maxRounds: 3,
    })
  })

  it('sin objetivo no arranca aunque haya invitados', () => {
    open(['rodrigo', 'ana'])
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).not.toHaveBeenCalled()
  })

  // Un solo aviso y con TODO lo que falta: antes «faltan participantes» salía
  // dos veces y lo de escribir el objetivo no se avisaba en ningún lado.
  it('con un solo invitado no arranca y dice qué falta', () => {
    open()
    typeGoal('tema')
    seat('rodrigo')
    expect(screen.getAllByText('tabs.brainstormMissing')).toHaveLength(1)
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).not.toHaveBeenCalled()
  })

  // El aviso deja sitio al coste en cuanto no falta nada: son el mismo hueco.
  it('el aviso se va cuando ya no falta nada', () => {
    open()
    expect(document.querySelector('.brainstorm-start__missing')).not.toBeNull()
    expect(document.querySelector('.brainstorm-start__cost')).toBeNull()
    typeGoal('tema')
    seat('rodrigo')
    seat('ana')
    expect(document.querySelector('.brainstorm-start__missing')).toBeNull()
    expect(document.querySelector('.brainstorm-start__cost')).not.toBeNull()
  })

  // Tocar el toggle sin querer no puede costar lo que llevabas armado: el
  // modal nunca se desmonta, era el reset al ABRIR lo que borraba el borrador.
  it('cerrar y volver a abrir conserva el borrador', () => {
    const { rerender } = render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={agents}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    typeGoal('¿Schema o RLS?')
    seat('rodrigo')

    const props = { cwd: '/repo', agents, onClose: () => {}, onStarted: () => {} }
    rerender(<BrainstormStartModal open={false} {...props} />)
    rerender(<BrainstormStartModal open {...props} />)

    expect(screen.getByDisplayValue('¿Schema o RLS?')).toBeTruthy()
    // El token de quién habla nombra a los sentados: sigue estando rodrigo.
    expect(document.querySelectorAll('.brainstorm-sentence__tok')[0].textContent)
      .toBe('rodrigo')
  })

  it('el orden en que se sientan es el que se manda a arrancar', () => {
    open(['rodrigo', 'nico'])
    typeGoal('tema')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['rodrigo', 'nico'],
    })
  })

  it('el orden de selección es el orden de habla', () => {
    open()
    typeGoal('tema')
    seat('nico')
    seat('ana')
    seat('rodrigo')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['nico', 'ana', 'rodrigo'],
    })
  })
})

describe('BrainstormStartModal — ajustes', () => {
  // Las plantillas ya no son lo primero de la pantalla: viven dentro de la
  // decisión que reemplazan, la salida. Y la conversación abierta no es una
  // entrada con un ajuste al lado: es cuatro formatos con nombre propio.
  it('las plantillas y las cuatro salidas viven en el mismo cajón', () => {
    open()
    expect(screen.queryByText('Example Mapping')).toBeNull()
    openToken('outcome')
    expect(screen.getByText('tabs.brainstormOutcomeIdeas')).toBeTruthy()
    expect(screen.getByText('tabs.brainstormOutcomeDecision')).toBeTruthy()
    expect(screen.getByText('tabs.brainstormOutcomePlan')).toBeTruthy()
    expect(screen.getByText('tabs.brainstormOutcomeCritique')).toBeTruthy()
    expect(screen.getByText('Example Mapping')).toBeTruthy()
    expect(screen.getByText('Sprint Planning')).toBeTruthy()
    // «Brainstorming» deja de aparecer: sus cuatro salidas ocupan su sitio.
    expect(screen.queryByText('Brainstorming')).toBeNull()
  })

  it('elegir una salida deja la sala en conversación abierta', () => {
    open(['rodrigo', 'ana'])
    typeGoal('tema')
    openToken('outcome')
    fireEvent.click(screen.getByText('Example Mapping'))
    // El cajón sigue abierto: elegir no lo cierra.
    fireEvent.click(screen.getByText('tabs.brainstormOutcomePlan'))
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      ceremony: 'free',
      outcome: 'plan',
    })
  })

  it('elegir formato arrastra sus rondas sugeridas', () => {
    open(['rodrigo', 'ana'])
    typeGoal('CT-119 solicitud de préstamo')
    openToken('outcome')
    fireEvent.click(screen.getByText('Specification Workshop'))
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      ceremony: 'specificationWorkshop',
      maxRounds: 6,
    })
  })

  // Con ceremonia la salida ya está fijada: el token la nombra en vez de
  // ofrecer las cuatro opciones como si aún se pudiera elegir.
  it('elegir una plantilla la pone en la frase', () => {
    open()
    expect(screen.getByText('tabs.brainstormOutcomeIdeasPhrase')).toBeTruthy()
    openToken('outcome')
    fireEvent.click(screen.getByText('Example Mapping'))
    expect(screen.getAllByText('Example Mapping').length).toBeGreaterThan(1)
  })

  it('avisa de los roles que la ceremonia pide y nadie cubre', () => {
    open(['rodrigo', 'ana'])
    openToken('outcome')
    fireEvent.click(screen.getByText('Three Amigos'))
    // Los roles son quién se sienta: viven en ese cajón, no en el de la salida.
    openToken('team')
    expect(screen.getByText('tabs.ceremonyRolesPartial')).toBeTruthy()
    seat('nico')
    expect(screen.getByText('tabs.ceremonyRolesCovered')).toBeTruthy()
  })

  it('nombra cada rol de la ceremonia y marca el asiento vacío', () => {
    open(['rodrigo'])
    openToken('outcome')
    fireEvent.click(screen.getByText('Three Amigos'))
    openToken('team')
    // Los tres roles que pide Three Amigos, con nombre propio.
    expect(screen.getByText('agentPane.ceremonyRoleProductOwner')).toBeTruthy()
    expect(screen.getByText('agentPane.ceremonyRoleDev')).toBeTruthy()
    expect(screen.getByText('agentPane.ceremonyRoleQa')).toBeTruthy()
    // Con un solo invitado quedan huecos declarados, no solo un conteo.
    expect(screen.getAllByText('tabs.ceremonyRoleMissing').length).toBeGreaterThan(0)
  })

  // Un rol sin cubrir se ve sin abrir nada: el token de quién habla queda gris.
  it('la plantilla con huecos deja el token de quién habla en pendiente', () => {
    open(['rodrigo', 'ana'])
    openToken('outcome')
    fireEvent.click(screen.getByText('Three Amigos'))
    const team = document.querySelectorAll('.brainstorm-sentence__tok')[0]
    expect(team.className).toContain('brainstorm-sentence__tok--todo')
  })

  it('la conversación abierta no pide roles: solo el orden de habla', () => {
    open(['rodrigo', 'ana'])
    expect(screen.queryByText('tabs.ceremonyRoleMissing')).toBeNull()
    openToken('team')
    expect(screen.getByText('tabs.brainstormOrderDragHint')).toBeTruthy()
  })
})

describe('BrainstormInviteGrid — identidad del agente', () => {
  it('sin monograma en la ficha se deriva del nombre', () => {
    open()
    // agentMonogram('rodrigo') → RO, un solo término.
    expect(screen.getByText('RO')).toBeTruthy()
    expect(screen.getByText('AN')).toBeTruthy()
    expect(screen.getByText('NI')).toBeTruthy()
  })

  it('el monograma de la ficha manda sobre el derivado del nombre', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[
          { ...agent('vanesa', 'qa expert'), name: 'Vanesa', monogram: 'QA' },
          agent('ana', 'tester'),
        ]}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    expect(screen.getByText('QA')).toBeTruthy()
    // 'Vanesa' derivaría 'VA': el campo de la ficha lo reemplaza.
    expect(screen.queryByText('VA')).toBeNull()
  })

  it('el rol de ceremonia desplaza al texto libre en la tarjeta', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[
          { ...agent('vanesa', 'qa expert'), name: 'Vanesa', ceremonyRole: 'qa' },
          agent('ana', 'tester'),
        ]}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    expect(screen.getByText('agentPane.ceremonyRoleQa')).toBeTruthy()
    expect(screen.queryByText('qa expert')).toBeNull()
  })
})

describe('BrainstormStartModal — el plano entero, sin modal', () => {
  it('se monta como overlay del plano, no como modal', () => {
    open()
    expect(document.querySelector('.brainstorm-overlay')).not.toBeNull()
    expect(document.querySelector('.terminal-modal-root')).toBeNull()
  })

  // Toda la configuración es una frase en el centro: la columna de ajustes
  // desaparece y con ella los cinco paneles que había que recorrer.
  it('sin columna de ajustes: la frase se lleva la configuración', () => {
    open()
    expect(document.querySelector('.brainstorm-overlay__col--left')).toBeNull()
    expect(document.querySelectorAll('.brainstorm-sentence__tok')).toHaveLength(4)
    expect(screen.queryByText('tabs.brainstormAdvancedLabel')).toBeNull()
  })

  // Cada cajón se abre bajo la frase y solo uno a la vez.
  it('abrir un cajón cierra el anterior', () => {
    open(['rodrigo', 'ana'])
    typeGoal('tema')
    openToken('material')
    expect(document.querySelector('.brainstorm-working-set')).not.toBeNull()
    openToken('time')
    expect(document.querySelector('.brainstorm-working-set')).toBeNull()
    expect(document.querySelectorAll('.brainstorm-sentence__drawer')).toHaveLength(1)
    expect(document.querySelectorAll('.brainstorm-start__cost')).toHaveLength(1)
  })

  it('los invitados van en la columna de la derecha, donde el plano pone agentes', () => {
    open(['rodrigo'])
    const right = document.querySelector('.brainstorm-overlay__col--right')
    expect(right).not.toBeNull()
    expect(right?.querySelectorAll('.brainstorm-seat--invite').length).toBe(agents.length)
    expect(right?.querySelectorAll('.brainstorm-seat--seated').length).toBe(1)
  })

  // El asiento no es una tarjeta parecida a la del plano: es la misma cara,
  // con los contextos del agente pintados como allí (icono + nombre).
  it('el asiento es la mini del plano con los contextos del agente', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[
          { ...agent('vanesa', 'QA'), contextIds: ['iaterminal:notes:Front-Rules'] },
          agent('ana', 'Dev'),
        ]}
        contexts={[{
          id: 'iaterminal:notes:Front-Rules',
          name: 'Front Rules',
          fileName: 'Front-Rules.md',
          kind: 'notes',
        }]}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    const card = [...document.querySelectorAll('.brainstorm-seat--invite')]
      .find(node => node.textContent?.includes('vanesa')) as HTMLElement
    expect(card.querySelector('.plane-mini-face')).not.toBeNull()
    expect(card.querySelector('button[aria-label="Front Rules"]')).not.toBeNull()
    // Sin asiento lo dice la cápsula de estado; sentarse la cambia por el turno.
    expect(card.textContent).toContain('tabs.brainstormSeatFree')
    fireEvent.click(card)
    expect(card.textContent).toContain('tabs.brainstormSeatTurn')
  })

  it('la sala reserva la franja de la barra de navegación', () => {
    open()
    const overlay = document.querySelector('.brainstorm-overlay')
    expect(overlay?.className).toContain('brainstorm-overlay--setup')
  })
})
