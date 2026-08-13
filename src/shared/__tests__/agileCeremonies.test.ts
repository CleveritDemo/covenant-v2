import { describe, expect, it } from 'vitest'
import {
  AI_READY_FIELDS,
  CEREMONY_IDS,
  aiReadyChecklist,
  ceremoniesByStage,
  ceremonyBlocksAiReady,
  ceremonyGateState,
  ceremonyRoleCoverage,
  ceremonyRolesForAgent,
  ceremonyUsesFreeOutcome,
  parseAiReadyGaps,
  sanitizeCeremonyId,
  sanitizeCeremonyRoleIds,
} from '../agileCeremonies'
import {
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  formatBrainstormClosing,
  parseBrainstormClosing,
  parseCeremonyClosing,
  type BrainstormRoom,
} from '../brainstormRoom'

describe('sanitizeCeremonyId', () => {
  it('cae a free con basura, null o una sala vieja sin campo', () => {
    expect(sanitizeCeremonyId(undefined)).toBe('free')
    expect(sanitizeCeremonyId(null)).toBe('free')
    expect(sanitizeCeremonyId('nope')).toBe('free')
    expect(sanitizeCeremonyId(7)).toBe('free')
  })

  it('respeta cualquier id del catálogo', () => {
    for (const id of CEREMONY_IDS) expect(sanitizeCeremonyId(id)).toBe(id)
  })
})

describe('ceremoniesByStage', () => {
  it('cubre las 10 ceremonias más el brainstorming libre', () => {
    expect(ceremoniesByStage('all')).toHaveLength(11)
    expect(ceremoniesByStage('free')).toHaveLength(1)
    expect(ceremoniesByStage('spec').map(item => item.id)).toEqual(['specificationWorkshop'])
  })
})

describe('ceremonyUsesFreeOutcome', () => {
  it('solo free deja elegir la salida a mano', () => {
    expect(ceremonyUsesFreeOutcome('free')).toBe(true)
    expect(ceremonyUsesFreeOutcome(undefined)).toBe(true)
    expect(ceremonyUsesFreeOutcome('exampleMapping')).toBe(false)
  })
})

describe('ceremonyRoleCoverage', () => {
  it('el tag manda: cruce exacto y sin adivinar', () => {
    const tagged = [
      { id: 'a', name: 'Alguien', role: 'texto que no dice nada', ceremonyRole: 'dev' as const },
      { id: 'b', name: 'Otro', role: 'irrelevante', ceremonyRole: 'qa' as const },
      { id: 'c', name: 'Tercero', role: 'irrelevante', ceremonyRole: 'productOwner' as const },
    ]
    expect(ceremonyRoleCoverage('threeAmigos', tagged)).toEqual([
      { role: 'productOwner', agentId: 'c', via: 'tag' },
      { role: 'qa', agentId: 'b', via: 'tag' },
      { role: 'dev', agentId: 'a', via: 'tag' },
    ])
  })

  it('un tag que la ceremonia no pide deja el asiento vacío', () => {
    const seats = ceremonyRoleCoverage('threeAmigos', [
      { id: 'ux', name: 'Uxi', ceremonyRole: 'ux' as const },
    ])
    expect(seats.every(seat => seat.agentId === null)).toBe(true)
  })

  it('el tag gana al texto libre aunque el texto diga otra cosa', () => {
    // El texto dice «product owner», el tag dice qa: manda el tag.
    const seats = ceremonyRoleCoverage('threeAmigos', [
      { id: 'x', name: 'X', role: 'product owner', ceremonyRole: 'qa' as const },
    ])
    expect(seats.find(seat => seat.role === 'qa')?.agentId).toBe('x')
    expect(seats.find(seat => seat.role === 'productOwner')?.agentId).toBeNull()
  })

  it('free no pide roles', () => {
    expect(ceremonyRoleCoverage('free', [])).toEqual([])
  })

  // Catálogo real sin etiquetar: respaldo por texto para no romper lo existente.
  const untagged = [
    { id: 'tl', name: 'Gian', role: 'technical leader' },
    { id: 'backend', name: 'Lenard', role: 'backend engineer' },
    { id: 'frontend', name: 'Carlos', role: 'frontend engineer' },
    { id: 'product-owner', name: 'Andre', role: 'product owner' },
    { id: 'qa', name: 'Daniel', role: 'quality assurance' },
  ]

  it('sin tag deduce del texto y lo marca como deducido', () => {
    expect(ceremonyRoleCoverage('eventStorming', untagged)).toEqual([
      { role: 'domainExpert', agentId: 'product-owner', via: 'guess' },
      { role: 'architect', agentId: 'tl', via: 'guess' },
      { role: 'dev', agentId: 'backend', via: 'guess' },
    ])
  })

  it('«QA Engineer» cubre el asiento QA sin colarse en dev', () => {
    const seats = ceremonyRoleCoverage('threeAmigos', [
      { id: 'ana', name: 'Ana', role: 'QA Engineer' },
    ])
    expect(seats.find(seat => seat.role === 'qa')?.agentId).toBe('ana')
    expect(seats.find(seat => seat.role === 'dev')?.agentId).toBeNull()
  })

  it('un nombre corto no se cuela dentro de un alias largo', () => {
    // «analyst» contiene «ana»: una Ana no es experta de dominio por eso.
    const seats = ceremonyRoleCoverage('eventStorming', [
      { id: 'ana', name: 'Ana', role: 'sin rol' },
    ])
    expect(seats.find(seat => seat.role === 'domainExpert')?.agentId).toBeNull()
  })

  it('las siglas de dos letras exigen palabra entera', () => {
    // «ui» vive dentro de «guild»: no debe cubrir UX.
    const seats = ceremonyRoleCoverage('userStoryMapping', [
      { id: 'guild', name: 'Guild', role: 'guild coordinator' },
    ])
    expect(seats.find(seat => seat.role === 'ux')?.agentId).toBeNull()
  })

  it('mezcla: los etiquetados se sientan primero y los demás rellenan', () => {
    const seats = ceremonyRoleCoverage('threeAmigos', [
      { id: 'dani', name: 'Dani', role: 'product owner' },
      { id: 'pepe', name: 'Pepe', role: 'lo que sea', ceremonyRole: 'productOwner' as const },
      { id: 'qa', name: 'Q', role: 'quality assurance' },
    ])
    expect(seats).toEqual([
      { role: 'productOwner', agentId: 'pepe', via: 'tag' },
      { role: 'qa', agentId: 'qa', via: 'guess' },
      { role: 'dev', agentId: null, via: null },
    ])
  })
})

describe('parseCeremonyClosing', () => {
  const text = [
    'Rules: monto máximo 50.000; edad mínima 18',
    '- **Examples:** edad 25 → aprobado; edad 16 → rechazado',
    'Questions: ¿qué pasa si cumple 18 mañana?',
    'Out of scope: comité manual',
  ].join('\n')

  it('lee las etiquetas de la ceremonia, con viñeta y negritas', () => {
    const closing = parseCeremonyClosing(text, 'exampleMapping')
    expect(closing?.entries.map(entry => entry.key)).toEqual([
      'rules',
      'examples',
      'questions',
      'out-of-scope',
    ])
    expect(closing?.fields.examples).toBe('edad 25 → aprobado; edad 16 → rechazado')
  })

  it('sin ninguna etiqueta reconocible no inventa cierre', () => {
    expect(parseCeremonyClosing('un párrafo cualquiera', 'exampleMapping')).toBeNull()
  })

  it('free no tiene cierre de ceremonia: usa el genérico', () => {
    expect(parseCeremonyClosing('Rules: x', 'free')).toBeNull()
    expect(parseBrainstormClosing('Decision: seguimos')?.decision).toBe('seguimos')
  })
})

describe('ceremonyGateState', () => {
  it('preguntas abiertas dejan el gate abierto y bloquean AI-Ready', () => {
    const fields = { questions: '¿qué pasa si cumple 18 mañana?' }
    expect(ceremonyGateState('exampleMapping', fields)).toBe('open')
    expect(ceremonyBlocksAiReady('exampleMapping', fields)).toBe(true)
  })

  it('«none» cierra el gate', () => {
    for (const value of ['none', 'None.', 'ninguna', '-', '0']) {
      expect(ceremonyGateState('exampleMapping', { questions: value })).toBe('closed')
    }
    expect(ceremonyBlocksAiReady('exampleMapping', { questions: 'none' })).toBe(false)
  })

  it('sin la línea del gate el estado es desconocido y no bloquea', () => {
    expect(ceremonyGateState('exampleMapping', { rules: 'x' })).toBe('unknown')
    expect(ceremonyBlocksAiReady('exampleMapping', { rules: 'x' })).toBe(false)
  })

  it('un gate no bloqueante nunca bloquea, aunque esté abierto', () => {
    const fields = { questions: 'falta confirmar el SLA' }
    expect(ceremonyGateState('threeAmigos', fields)).toBe('open')
    expect(ceremonyBlocksAiReady('threeAmigos', fields)).toBe(false)
  })
})

describe('parseAiReadyGaps', () => {
  it('reconoce las claves del checklist y descarta lo inventado', () => {
    expect(parseAiReadyGaps('test-data, questions, unicornio')).toEqual(['test-data', 'questions'])
  })

  it('«none» o vacío = checklist completo', () => {
    expect(parseAiReadyGaps('none')).toEqual([])
    expect(parseAiReadyGaps(undefined)).toEqual([])
  })

  it('el checklist marca los 11 campos y señala el bloqueante', () => {
    const list = aiReadyChecklist(['test-data'])
    expect(list).toHaveLength(AI_READY_FIELDS.length)
    expect(list.find(item => item.field === 'test-data')?.ok).toBe(false)
    expect(list.find(item => item.field === 'questions')?.blocking).toBe(true)
  })
})

describe('buildBrainstormTurnPrompt con ceremonia', () => {
  function roomFor(ceremony: string | undefined): BrainstormRoom {
    const room = createBrainstormRoom('CT-119 préstamo digital', ['a', 'b'], 1, {
      outcome: 'ideas',
      ceremony,
    })
    if (!room) throw new Error('sala no creada')
    return room
  }

  it('free mantiene el prompt de siempre', () => {
    const prompt = buildBrainstormTurnPrompt(roomFor(undefined), 'a', 'Ana')
    expect(prompt).toContain('Brainstorm room — one speaking turn.')
    expect(prompt).toContain('Desired outcome: a spread of distinct options')
    expect(prompt).not.toContain('Ceremony:')
  })

  it('con ceremonia manda el objetivo y los entregables, no la salida a mano', () => {
    const prompt = buildBrainstormTurnPrompt(roomFor('exampleMapping'), 'a', 'Ana')
    expect(prompt).toContain('Example Mapping session — one speaking turn.')
    expect(prompt).toContain('Ceremony: Example Mapping.')
    expect(prompt).toContain('Deliverables of this ceremony:')
    expect(prompt).not.toContain('Desired outcome:')
  })

  it('el turno final pide las etiquetas de la ceremonia, no Decision/Why', () => {
    // maxRounds 1 y cursor en el último asiento = turno de cierre.
    const room = { ...roomFor('exampleMapping'), cursor: 1 }
    const prompt = buildBrainstormTurnPrompt(room, 'b', 'Nico')
    expect(prompt).toContain('Questions: <')
    expect(prompt).toContain('Out of scope: <')
    expect(prompt).not.toContain('Decision: <')
  })

  it('el turno final de free sigue pidiendo Decision', () => {
    const room = { ...roomFor('free'), cursor: 1 }
    expect(buildBrainstormTurnPrompt(room, 'b', 'Nico')).toContain('Decision: <')
  })
})

describe('ceremonyRoleCoverage — un agente con varios sombreros', () => {
  const po = { id: 'maria', name: 'Maria', ceremonyRoles: ['productOwner' as const] }
  const dev = { id: 'david', name: 'David', ceremonyRoles: ['dev' as const] }
  const qa = { id: 'vanesa', name: 'Vanesa', ceremonyRoles: ['qa' as const] }
  /** Tech Lead real: arquitecto, pero también programa y prueba. */
  const techLead = {
    id: 'techlead',
    name: 'Tech Lead',
    ceremonyRoles: ['architect' as const, 'dev' as const, 'qa' as const],
  }

  it('reparte antes que doblar: con gente de sobra nadie lleva dos sombreros', () => {
    const seats = ceremonyRoleCoverage('threeAmigos', [techLead, po, dev, qa])
    const byRole = Object.fromEntries(seats.map(seat => [seat.role, seat]))
    expect(byRole.productOwner?.agentId).toBe('maria')
    expect(byRole.dev?.agentId).toBe('david')
    expect(byRole.qa?.agentId).toBe('vanesa')
    // Nadie repetido: tres asientos, tres agentes distintos.
    expect(new Set(seats.map(seat => seat.agentId)).size).toBe(3)
    expect(seats.every(seat => seat.via === 'tag')).toBe(true)
  })

  it('dobla solo para tapar el hueco que nadie más cubre', () => {
    const seats = ceremonyRoleCoverage('threeAmigos', [techLead, po])
    const byRole = Object.fromEntries(seats.map(seat => [seat.role, seat]))
    expect(byRole.productOwner?.agentId).toBe('maria')
    // El Tech Lead cubre los otros dos: uno por tag y el otro como 2º sombrero.
    expect(byRole.dev?.agentId).toBe('techlead')
    expect(byRole.qa?.agentId).toBe('techlead')
    expect(seats.filter(seat => seat.via === 'double')).toHaveLength(1)
    expect(seats.every(seat => seat.agentId)).toBe(true)
  })

  it('el segundo sombrero exige declararlo: no se dobla por corazonada del texto', () => {
    // «backend engineer» adivinaría `dev`, pero sin tag no se le dobla a QA.
    const guessed = { id: 'cristian', name: 'Cristian', role: 'backend engineer' }
    const seats = ceremonyRoleCoverage('threeAmigos', [guessed, po])
    const byRole = Object.fromEntries(seats.map(seat => [seat.role, seat]))
    expect(byRole.dev?.agentId).toBe('cristian')
    expect(byRole.dev?.via).toBe('guess')
    expect(byRole.qa?.agentId).toBeNull()
  })

  it('la ficha antigua de un solo rol sigue sentando igual', () => {
    const legacy = { id: 'ana', name: 'Ana', ceremonyRole: 'qa' as const }
    const seats = ceremonyRoleCoverage('threeAmigos', [legacy, po, dev])
    const byRole = Object.fromEntries(seats.map(seat => [seat.role, seat]))
    expect(byRole.qa?.agentId).toBe('ana')
    expect(byRole.qa?.via).toBe('tag')
  })
})

describe('ceremonyRolesForAgent', () => {
  const techLead = {
    id: 'techlead',
    name: 'Tech Lead',
    ceremonyRoles: ['architect' as const, 'dev' as const, 'qa' as const],
  }
  const po = { id: 'maria', ceremonyRoles: ['productOwner' as const] }

  it('devuelve los asientos que ocupa, en orden de la ceremonia', () => {
    expect(ceremonyRolesForAgent('threeAmigos', [techLead, po], 'techlead'))
      .toEqual(['qa', 'dev'])
  })

  it('un solo asiento devuelve un solo rol', () => {
    expect(ceremonyRolesForAgent('threeAmigos', [techLead, po], 'maria'))
      .toEqual(['productOwner'])
  })

  it('quien no se sienta no ocupa nada', () => {
    expect(ceremonyRolesForAgent('threeAmigos', [techLead, po], 'nadie')).toEqual([])
  })
})

describe('sanitizeCeremonyRoleIds', () => {
  it('descarta lo que no es rol, deduplica y ordena por catálogo', () => {
    expect(sanitizeCeremonyRoleIds(['qa', 'productOwner', 'qa', 'inventado', 7]))
      .toEqual(['productOwner', 'qa'])
  })

  it('lo que no es lista da lista vacía', () => {
    expect(sanitizeCeremonyRoleIds('qa')).toEqual([])
    expect(sanitizeCeremonyRoleIds(undefined)).toEqual([])
  })
})

describe('buildBrainstormTurnPrompt — sombreros del orador', () => {
  const room = createBrainstormRoom(
    'CT-89 lista para desarrollo',
    ['techlead', 'maria'],
    2,
    { ceremony: 'threeAmigos' },
  ) as BrainstormRoom

  it('con dos asientos se lo declara y le pide hablar por los dos', () => {
    const prompt = buildBrainstormTurnPrompt(
      room, 'techlead', 'Tech Lead', 'technical leader', undefined, ['qa', 'dev'],
    )
    expect(prompt).toContain('you cover 2 roles: QA / QE and Developer')
    expect(prompt).toContain('Speak for all of them')
  })

  it('con un solo asiento no ensucia el turno', () => {
    const prompt = buildBrainstormTurnPrompt(
      room, 'maria', 'Maria', 'product owner', undefined, ['productOwner'],
    )
    expect(prompt).not.toContain('you cover')
  })

  it('sin ceremonia ni asientos el prompt es el de siempre', () => {
    const prompt = buildBrainstormTurnPrompt(room, 'maria', 'Maria', 'product owner')
    expect(prompt).not.toContain('you cover')
  })
})

describe('parseBrainstormClosing — bloques de varias líneas', () => {
  it('recoge la lista que va debajo de la etiqueta', () => {
    const closing = parseBrainstormClosing([
      'Decision: Ship the intersection now.',
      '',
      'Agreed:',
      '- The R kind is out of the schema.',
      '- New kinds die on downgrade.',
      '- Additive fields only.',
      '',
      'Next: Cristian writes the outcome field.',
    ].join('\n'))
    expect(closing?.decision).toBe('Ship the intersection now.')
    expect(closing?.agreed).toBe([
      '- The R kind is out of the schema.',
      '- New kinds die on downgrade.',
      '- Additive fields only.',
    ].join('\n'))
    expect(closing?.next).toBe('Cristian writes the outcome field.')
  })

  it('un valor que sigue en la línea siguiente no se pierde', () => {
    const closing = parseBrainstormClosing([
      'Decision: Ship the intersection now;',
      'the versioned-vs-unversioned question waits on the backend.',
      'Why: the stop-write path holds on both forks.',
    ].join('\n'))
    expect(closing?.decision).toBe(
      'Ship the intersection now;\nthe versioned-vs-unversioned question waits on the backend.',
    )
    expect(closing?.why).toBe('the stop-write path holds on both forks.')
  })

  it('la línea en blanco no corta el bloque, solo otra etiqueta', () => {
    const closing = parseBrainstormClosing([
      'Decision: A',
      '',
      '- segunda parte de la decisión',
      'Why: B',
    ].join('\n'))
    expect(closing?.decision).toBe('A\n- segunda parte de la decisión')
    expect(closing?.why).toBe('B')
  })

  it('sin línea Decision no hay tarjeta, como siempre', () => {
    expect(parseBrainstormClosing('un párrafo cualquiera')).toBeNull()
    expect(parseBrainstormClosing('Decision:')).toBeNull()
  })

  it('el cierre de ceremonia también admite listas', () => {
    const closing = parseCeremonyClosing([
      'Rules:',
      '- monto máximo 50.000',
      '- edad mínima 18',
      'Examples: edad 25 → aprobado',
      'Questions: none',
    ].join('\n'), 'exampleMapping')
    expect(closing?.fields.rules).toBe('- monto máximo 50.000\n- edad mínima 18')
    expect(closing?.fields.questions).toBe('none')
  })

  it('el Markdown baja el bloque multilínea a su propio renglón', () => {
    const md = formatBrainstormClosing('Tema', {
      decision: 'A',
      agreed: '- uno\n- dos',
    })
    expect(md).toContain('**Agreed:**\n- uno\n- dos')
    expect(md).toContain('**Decision:** A')
  })
})
