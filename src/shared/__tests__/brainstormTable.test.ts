import { describe, expect, it } from 'vitest'
import {
  availableSeatCandidates,
  filterSeatableAgents,
  canStartBrainstormTable,
  moveSeat,
  seatAgent,
  unseatAgent,
} from '../brainstormTable'

describe('seatAgent', () => {
  it('sienta al final por defecto y en la posición pedida con índice', () => {
    expect(seatAgent([], 'qa')).toEqual(['qa'])
    expect(seatAgent(['qa', 'backend'], 'frontend')).toEqual(['qa', 'backend', 'frontend'])
    expect(seatAgent(['qa', 'backend'], 'frontend', 0)).toEqual(['frontend', 'qa', 'backend'])
    expect(seatAgent(['qa', 'backend'], 'frontend', 1)).toEqual(['qa', 'frontend', 'backend'])
  })

  it('reubica en vez de duplicar cuando el agente ya está sentado', () => {
    expect(seatAgent(['qa', 'backend', 'frontend'], 'frontend', 0))
      .toEqual(['frontend', 'qa', 'backend'])
    expect(seatAgent(['qa', 'backend'], 'qa', 5)).toEqual(['backend', 'qa'])
  })

  it('ignora ids vacíos y recorta índices fuera de rango', () => {
    expect(seatAgent(['qa'], '  ')).toEqual(['qa'])
    expect(seatAgent(['qa'], 'backend', -3)).toEqual(['backend', 'qa'])
    expect(seatAgent(['qa'], 'backend', 99)).toEqual(['qa', 'backend'])
  })
})

describe('unseatAgent', () => {
  it('saca al agente y deja el resto en orden', () => {
    expect(unseatAgent(['qa', 'backend', 'frontend'], 'backend')).toEqual(['qa', 'frontend'])
    expect(unseatAgent(['qa'], 'nadie')).toEqual(['qa'])
  })
})

describe('moveSeat', () => {
  it('mueve el asiento y respeta los bordes', () => {
    expect(moveSeat(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveSeat(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    // El primero no sube y el último no baja: la lista no se toca.
    expect(moveSeat(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveSeat(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(moveSeat(['a', 'b'], 'z', 1)).toEqual(['a', 'b'])
  })
})

describe('availableSeatCandidates', () => {
  it('deja fuera a los ya sentados y a los panes sin agente', () => {
    const agents = [
      { paneId: 'p1', agentId: 'qa' },
      { paneId: 'p2', agentId: 'backend' },
      { paneId: 'p3' },
    ]
    expect(availableSeatCandidates(agents, ['backend']).map(a => a.paneId)).toEqual(['p1'])
  })
})

describe('filterSeatableAgents', () => {
  it('deja fuera a las réplicas del turbo y a los panes sin agente', () => {
    const agents = [
      { agentId: 'frontend' },
      // Réplica por binding de sesión…
      { agentId: 'frontend-2', localOnly: true },
      // …y réplica reconocida solo por el tag que pinta el plano.
      { agentId: 'frontend-3', instanceTag: 'R3' },
      { agentId: '  ' },
      { agentId: 'qa', localOnly: false },
    ]
    expect(filterSeatableAgents(agents).map(a => a.agentId)).toEqual(['frontend', 'qa'])
  })
})

describe('canStartBrainstormTable', () => {
  it('pide dos asientos distintos', () => {
    expect(canStartBrainstormTable([])).toBe(false)
    expect(canStartBrainstormTable(['qa'])).toBe(false)
    expect(canStartBrainstormTable(['qa', 'qa'])).toBe(false)
    expect(canStartBrainstormTable(['qa', 'backend'])).toBe(true)
  })
})
