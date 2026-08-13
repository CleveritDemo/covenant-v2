/**
 * Ceremonias ágiles seleccionables al abrir una sala (CT-128).
 *
 * Una sala ya no es siempre un brainstorming: la ceremonia decide el objetivo
 * del turno, los entregables que se piden al cierre y el gate que declara si la
 * historia queda AI-Ready. `free` es el brainstorming de siempre y es el valor
 * por defecto, así que las salas guardadas sin ceremonia siguen funcionando.
 *
 * Los textos de este catálogo van al prompt, que está en inglés. Lo que lee el
 * facilitador (objetivo y gate) sale de i18n con las claves `ceremony.*`.
 */

export const CEREMONY_IDS = [
  'free',
  'eventStorming',
  'userStoryMapping',
  'impactMapping',
  'oopsiMapping',
  'threeAmigos',
  'exampleMapping',
  'featureMapping',
  'specificationWorkshop',
  'backlogRefinement',
  'sprintPlanning',
] as const

export type CeremonyId = typeof CEREMONY_IDS[number]

/**
 * Roles que puede pedir una ceremonia. Lista cerrada a propósito: el `role`
 * de un agente es texto libre, y cruzarlo por texto obliga a revalidar el
 * catálogo cada vez que alguien escribe «technical leader» en vez de
 * «architect». Un agente se etiqueta con uno de estos y el cruce es exacto.
 */
export const CEREMONY_ROLE_IDS = [
  'productOwner',
  'domainExpert',
  'architect',
  'dev',
  'qa',
  'ux',
  'stakeholder',
  'scrumMaster',
] as const
export type CeremonyRoleId = typeof CEREMONY_ROLE_IDS[number]

export function isCeremonyRoleId(raw: unknown): raw is CeremonyRoleId {
  return (CEREMONY_ROLE_IDS as readonly string[]).includes(raw as string)
}

/** El tag del agente, o undefined si no lo tiene puesto. */
export function sanitizeCeremonyRoleId(raw: unknown): CeremonyRoleId | undefined {
  return isCeremonyRoleId(raw) ? raw : undefined
}

/**
 * Los roles de un agente: lista cerrada, sin duplicados y en el orden del
 * catálogo, que es el que decide qué sombrero se le nombra primero.
 * El tope es la propia lista: nadie declara más roles de los que existen.
 */
export function sanitizeCeremonyRoleIds(raw: unknown): CeremonyRoleId[] {
  if (!Array.isArray(raw)) return []
  const declared = new Set(raw.filter(isCeremonyRoleId))
  return CEREMONY_ROLE_IDS.filter(role => declared.has(role))
}

/**
 * Nombre en inglés de cada rol: va al prompt del turno, que está en inglés.
 * Lo que lee el humano sale de i18n (`agentPane.ceremonyRole*`).
 */
export const CEREMONY_ROLE_PROMPT_LABEL: Readonly<Record<CeremonyRoleId, string>> = {
  productOwner: 'Product Owner',
  domainExpert: 'Domain expert',
  architect: 'Architect / Tech Lead',
  dev: 'Developer',
  qa: 'QA / QE',
  ux: 'UX',
  stakeholder: 'Stakeholder',
  scrumMaster: 'Scrum Master',
}

/** Etapa del pipeline; ordena el picker y agrupa el filtro. */
export const CEREMONY_STAGES = ['free', 'discovery', 'align', 'spec', 'deliver'] as const
export type CeremonyStage = typeof CEREMONY_STAGES[number]

/**
 * Etiqueta que el último turno debe escribir y que el cierre parsea.
 * ponytail: la etiqueta se muestra tal cual, sin traducir — es vocabulario BDD
 * (Rules, Examples, Questions) que nadie traduce en la literatura, igual que
 * Given/When/Then. Si alguien lo pide, i18n por `key`.
 */
export interface CeremonyClosingField {
  key: string
  label: string
  /** Qué se le pide en esa línea; va al prompt del turno final. */
  hint: string
}

export interface CeremonyGate {
  /**
   * Etiqueta de cierre que decide el gate. Vacía o «none» = gate cerrado.
   * Sin `field` el gate es informativo y no se evalúa.
   */
  field?: string
  /** Bloquea el sello AI-Ready (no el cierre de la sala). */
  blocking: boolean
}

export interface AgileCeremony {
  id: CeremonyId
  stage: CeremonyStage
  /** Nombre propio del dominio ágil: idéntico en los dos locales. */
  name: string
  /** Objetivo del turno, en inglés, para el prompt. */
  objective: string
  /** Entregables; chips en la UI y lista en el prompt. */
  deliverables: string[]
  /** Roles sugeridos, en orden de habla. Se casan con el tag del agente. */
  roles: CeremonyRoleId[]
  /** Rondas por defecto al elegir la ceremonia. */
  rounds: number
  gate?: CeremonyGate
  /** Etiquetas del turno final. Vacío = cierre genérico (Decision/Why/…). */
  closing: CeremonyClosingField[]
}

/** Los 11 campos de una AI-Ready Story. Las claves las escribe el modelo. */
export const AI_READY_FIELDS = [
  'story',
  'ears',
  'rules',
  'gherkin',
  'positive',
  'negative',
  'deps',
  'test-data',
  'nfr',
  'dor',
  'questions',
] as const
export type AiReadyField = typeof AI_READY_FIELDS[number]

/** Campo del checklist que bloquea por sí solo (regla del CT-128). */
export const AI_READY_BLOCKING_FIELD: AiReadyField = 'questions'

const CEREMONY_LIST: readonly AgileCeremony[] = [
  {
    id: 'free',
    stage: 'free',
    name: 'Brainstorming',
    objective: 'Explore the topic in the open and keep the ideas that hold up.',
    deliverables: ['Ideas', 'Risks', 'Next step'],
    roles: [],
    rounds: 3,
    closing: [],
  },
  {
    id: 'eventStorming',
    stage: 'discovery',
    name: 'Event Storming',
    objective: 'Walk the business process end to end and surface its events, actors and dependencies.',
    deliverables: ['Events', 'Actors', 'Commands', 'Policies', 'Systems', 'Dependencies', 'Risks'],
    roles: ['domainExpert', 'architect', 'dev'],
    rounds: 6,
    gate: { blocking: false },
    closing: [
      { key: 'events', label: 'Events', hint: 'the business events, in order' },
      { key: 'actors', label: 'Actors', hint: 'who triggers them' },
      { key: 'policies', label: 'Policies', hint: 'the rules that fire on an event' },
      { key: 'risks', label: 'Risks', hint: 'dependencies and unknowns' },
    ],
  },
  {
    id: 'userStoryMapping',
    stage: 'discovery',
    name: 'User Story Mapping',
    objective: 'Order the user journey into activities and decide what the MVP carries.',
    deliverables: ['Journey', 'Activities', 'Epics', 'Stories', 'Release / MVP'],
    roles: ['productOwner', 'ux', 'dev'],
    rounds: 5,
    gate: { field: 'Open', blocking: false },
    closing: [
      { key: 'activities', label: 'Activities', hint: 'the backbone, left to right' },
      { key: 'stories', label: 'Stories', hint: 'the slices under each activity' },
      { key: 'mvp', label: 'MVP', hint: 'what ships first and why' },
      { key: 'open', label: 'Open', hint: 'what is still undecided' },
    ],
  },
  {
    id: 'impactMapping',
    stage: 'discovery',
    name: 'Impact Mapping',
    objective: 'Connect the business goal to the deliverables that actually move it.',
    deliverables: ['Goal', 'Actors', 'Impacts', 'Deliverables'],
    roles: ['productOwner', 'stakeholder', 'dev'],
    rounds: 4,
    gate: { field: 'Open', blocking: false },
    closing: [
      { key: 'goal', label: 'Goal', hint: 'the measurable business goal' },
      { key: 'impacts', label: 'Impacts', hint: 'the behaviour changes wanted per actor' },
      { key: 'deliverables', label: 'Deliverables', hint: 'what we build for each impact' },
      { key: 'open', label: 'Open', hint: 'deliverables with no impact behind them' },
    ],
  },
  {
    id: 'oopsiMapping',
    stage: 'discovery',
    name: 'OOPSI Mapping',
    objective: 'Break the initiative into Outcomes, Outputs, Processes, Scenarios and Inputs.',
    deliverables: ['Outcomes', 'Outputs', 'Processes', 'Scenarios', 'Inputs'],
    roles: ['architect', 'qa', 'productOwner'],
    rounds: 6,
    gate: { blocking: false },
    closing: [
      { key: 'outcomes', label: 'Outcomes', hint: 'the results the business wants' },
      { key: 'processes', label: 'Processes', hint: 'the flows that produce them' },
      { key: 'scenarios', label: 'Scenarios', hint: 'the concrete cases per process' },
      { key: 'inputs', label: 'Inputs', hint: 'the data and systems each one needs' },
    ],
  },
  {
    id: 'threeAmigos',
    stage: 'align',
    name: 'Three Amigos',
    objective: 'Settle the story\'s assumptions between business, development and QA.',
    deliverables: ['Resolved questions', 'Risks', 'Preliminary acceptance criteria'],
    roles: ['productOwner', 'qa', 'dev'],
    rounds: 4,
    gate: { field: 'Questions', blocking: false },
    closing: [
      { key: 'resolved', label: 'Resolved', hint: 'the assumptions you settled, and how' },
      { key: 'risks', label: 'Risks', hint: 'the dependencies that stayed' },
      { key: 'criteria', label: 'Criteria', hint: 'preliminary acceptance criteria, Given/When/Then' },
      { key: 'questions', label: 'Questions', hint: 'still open, or "none"' },
    ],
  },
  {
    id: 'exampleMapping',
    stage: 'align',
    name: 'Example Mapping',
    objective: 'Pull the story\'s rules out with concrete examples and leave zero open questions.',
    deliverables: ['Rules', 'Examples', 'Questions', 'Out of scope'],
    roles: ['productOwner', 'qa', 'dev'],
    rounds: 5,
    gate: { field: 'Questions', blocking: true },
    closing: [
      { key: 'rules', label: 'Rules', hint: 'one line per business rule' },
      { key: 'examples', label: 'Examples', hint: 'input → expected result, positive and negative' },
      { key: 'questions', label: 'Questions', hint: 'still open, or "none" — this one gates the story' },
      { key: 'out-of-scope', label: 'Out of scope', hint: 'what you explicitly left out' },
    ],
  },
  {
    id: 'featureMapping',
    stage: 'align',
    name: 'Feature Mapping',
    objective: 'Split the feature into behaviours and give every behaviour an example.',
    deliverables: ['Functional tree', 'Behaviours', 'Examples'],
    roles: ['qa', 'dev', 'productOwner'],
    rounds: 5,
    gate: { field: 'Questions', blocking: false },
    closing: [
      { key: 'behaviours', label: 'Behaviours', hint: 'the leaves of the functional tree' },
      { key: 'examples', label: 'Examples', hint: 'one example per behaviour' },
      { key: 'questions', label: 'Questions', hint: 'behaviours with no example yet, or "none"' },
    ],
  },
  {
    id: 'specificationWorkshop',
    stage: 'spec',
    name: 'Specification Workshop',
    objective: 'Express the whole story in Gherkin and close the AI-Ready checklist.',
    deliverables: ['Gherkin scenarios', 'Case matrix', 'Formalized rules (RN-00n)', 'EARS criteria'],
    roles: ['qa', 'dev', 'productOwner'],
    rounds: 6,
    gate: { field: 'AI-Ready gaps', blocking: true },
    closing: [
      { key: 'scenarios', label: 'Scenarios', hint: 'Gherkin, Feature → Scenario → Given/When/Then' },
      { key: 'rules', label: 'Rules', hint: 'formalized as RN-001, RN-002, …' },
      { key: 'test-data', label: 'Test data', hint: 'the data each scenario needs' },
      {
        key: 'ai-ready-gaps',
        label: 'AI-Ready gaps',
        hint: `comma-separated keys still missing from this list — ${AI_READY_FIELDS.join(', ')} — or "none"`,
      },
    ],
  },
  {
    id: 'backlogRefinement',
    stage: 'deliver',
    name: 'Backlog Refinement',
    objective: 'Refine and size the story until it meets the Definition of Ready.',
    deliverables: ['Refined story', 'Estimate', 'Definition of Ready'],
    roles: ['productOwner', 'dev', 'qa'],
    rounds: 3,
    gate: { field: 'Open', blocking: false },
    closing: [
      { key: 'story', label: 'Story', hint: 'the refined story, Connextra form' },
      { key: 'estimate', label: 'Estimate', hint: 'the size and what drives it' },
      { key: 'ready', label: 'Ready', hint: 'which Definition of Ready items pass' },
      { key: 'open', label: 'Open', hint: 'what still blocks it, or "none"' },
    ],
  },
  {
    id: 'sprintPlanning',
    stage: 'deliver',
    name: 'Sprint Planning',
    objective: 'Commit the sprint scope and break it into tasks.',
    deliverables: ['Sprint Backlog', 'Sprint goal', 'Tasks'],
    roles: ['productOwner', 'dev', 'scrumMaster'],
    rounds: 3,
    gate: { field: 'Open', blocking: true },
    closing: [
      { key: 'sprint-goal', label: 'Sprint goal', hint: 'one sentence' },
      { key: 'committed', label: 'Committed', hint: 'the stories taken in' },
      { key: 'tasks', label: 'Tasks', hint: 'the breakdown, with owners if there are any' },
      { key: 'open', label: 'Open', hint: 'stories still carrying open questions, or "none"' },
    ],
  },
]

export const CEREMONIES: Readonly<Record<CeremonyId, AgileCeremony>> = Object.freeze(
  Object.fromEntries(CEREMONY_LIST.map(item => [item.id, item])) as Record<CeremonyId, AgileCeremony>,
)

export const DEFAULT_CEREMONY_ID: CeremonyId = 'free'

/** Ceremonia por defecto para todo lo que venga de disco, IPC o una sala vieja. */
export function sanitizeCeremonyId(raw: unknown): CeremonyId {
  return (CEREMONY_IDS as readonly string[]).includes(raw as string)
    ? raw as CeremonyId
    : DEFAULT_CEREMONY_ID
}

export function ceremonyById(raw: unknown): AgileCeremony {
  return CEREMONIES[sanitizeCeremonyId(raw)]
}

/** Catálogo en orden de pipeline; `free` primero por compatibilidad. */
export function ceremoniesInPipelineOrder(): AgileCeremony[] {
  return [...CEREMONY_LIST]
}

export function ceremoniesByStage(stage: CeremonyStage | 'all'): AgileCeremony[] {
  return stage === 'all'
    ? ceremoniesInPipelineOrder()
    : CEREMONY_LIST.filter(item => item.stage === stage)
}

/** Sin ceremonia elegida el usuario sigue eligiendo la salida a mano. */
export function ceremonyUsesFreeOutcome(id: unknown): boolean {
  return sanitizeCeremonyId(id) === DEFAULT_CEREMONY_ID
}

/**
 * Normaliza texto para comparar: minúsculas, sin acentos, sin separadores.
 * Local a propósito — importar el slug del catálogo de agentes cerraría un
 * ciclo, porque el catálogo importa los roles de aquí.
 */
function slug(raw: string): string {
  return normalizeText(raw).replace(/[^a-z0-9]+/g, '')
}

/** Minúsculas sin acentos, conservando los separadores como espacios. */
function normalizeText(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Sinónimos de cada rol pedido, contra el `role` que la gente escribe de
 * verdad: un «technical leader» cubre `architect` y un «backend engineer`
 * cubre `dev`. Sin esto el cruce solo acertaba si el catálogo usaba
 * literalmente mis palabras, y un proyecto normal daba «0 de 3».
 *
 * Claves: slug de la etiqueta del rol en el catálogo de ceremonias.
 */
const ROLE_ALIASES: Readonly<Record<CeremonyRoleId, readonly string[]>> = {
  productOwner: [
    'product owner', 'po', 'product manager', 'product', 'business owner',
    'negocio', 'dueño de producto',
  ],
  qa: ['qa', 'quality assurance', 'quality', 'qe', 'quality engineer', 'tester', 'testing', 'calidad'],
  dev: [
    'dev', 'developer', 'desarrollador', 'desarrollo', 'backend', 'frontend', 'fullstack',
    'full stack', 'software engineer', 'programmer', 'programador', 'ingeniero de software',
  ],
  architect: [
    'architect', 'arquitecto', 'technical leader', 'tech lead', 'techlead', 'tl',
    'staff engineer', 'principal engineer', 'solution architect',
  ],
  domainExpert: [
    'domain expert', 'business analyst', 'analyst', 'analista', 'subject matter expert',
    'sme', 'experto de dominio', 'domain', 'product owner', 'negocio',
  ],
  ux: ['ux', 'designer', 'design', 'diseñador', 'diseño', 'ui', 'product designer'],
  stakeholder: ['stakeholder', 'sponsor', 'business', 'negocio', 'product owner', 'cliente'],
  scrumMaster: ['scrum master', 'sm', 'agile coach', 'coach', 'facilitator', 'facilitador', 'scrum'],
}

/** Palabras de un texto: «QA Engineer» → ['qa', 'engineer']. */
function words(raw: string): string[] {
  return normalizeText(raw).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Casa un término con el texto de un agente: palabra entera, o el término
 * como subcadena del texto («backend» dentro de «backend engineer»).
 *
 * Solo en esa dirección. Al revés, un término largo contendría nombres cortos
 * por accidente: «analyst» contiene «ana», y un agente llamado Ana pasaba por
 * experto de dominio. Las siglas de dos letras (`po`, `tl`, `sm`, `ui`) exigen
 * palabra entera, porque «ui» vive dentro de «guild».
 */
function termMatches(term: string, hayWords: readonly string[], hayJoined: string): boolean {
  const termWords = words(term)
  const needle = termWords.join('')
  if (!needle || !hayJoined) return false
  if (termWords.length === 1) {
    if (hayWords.includes(needle)) return true
  } else if (termWords.every(word => hayWords.includes(word))) {
    // Multi-palabra: hacen falta todas. Bastaba una y «quality engineer»
    // casaba con cualquier «… engineer», así que un «backend engineer»
    // se sentaba en el asiento de QA.
    return true
  }
  if (needle.length <= 2) return false
  return hayJoined.includes(needle)
}

export interface CeremonyRoleSeat {
  /** Rol pedido por la ceremonia. */
  role: CeremonyRoleId
  /** Id del agente sentado que lo cubre, o null. */
  agentId: string | null
  /**
   * Cómo se resolvió: `tag` es el rol declarado del agente; `guess` viene de
   * leerle el texto y puede equivocarse; `double` es un segundo sombrero, un
   * agente que ya tenía asiento y tapa además este hueco. La UI los distingue
   * para que se sepa cuándo hace falta etiquetar o sentar a alguien más.
   */
  via: 'tag' | 'guess' | 'double' | null
}

export type CeremonyRoleCandidate = {
  id: string
  name?: string
  /** Texto libre de la ficha del agente; solo respaldo. */
  role?: string
  /** Roles declarados del agente: lo que manda. */
  ceremonyRoles?: readonly CeremonyRoleId[]
  /** @deprecated Forma anterior de un solo rol; se lee para no romper fichas viejas. */
  ceremonyRole?: CeremonyRoleId
}

/**
 * Roles declarados de un agente, tolerando la ficha antigua de un solo rol.
 * Un agente sin tag devuelve lista vacía: ahí entra el respaldo por texto.
 */
export function candidateCeremonyRoles(
  agent: Pick<CeremonyRoleCandidate, 'ceremonyRoles' | 'ceremonyRole'>,
): CeremonyRoleId[] {
  const many = sanitizeCeremonyRoleIds(agent.ceremonyRoles)
  if (many.length) return many
  const one = sanitizeCeremonyRoleId(agent.ceremonyRole)
  return one ? [one] : []
}

/** Respaldo para agentes sin tag: leerles el texto y adivinar. */
function guessesRole(agent: CeremonyRoleCandidate, role: CeremonyRoleId): boolean {
  const terms = ROLE_ALIASES[role]
  return [agent.role ?? '', agent.name ?? '', agent.id].some(raw => {
    const hayWords = words(raw)
    if (!hayWords.length) return false
    const hayJoined = hayWords.join('')
    return terms.some(term => termMatches(term, hayWords, hayJoined))
  })
}

/**
 * Cruza los roles de la ceremonia con los agentes ya sentados en la mesa.
 *
 * Tres pasadas, y el orden es la regla de negocio: **repartir antes que
 * doblar**. Un equipo de tres no debería poner dos sombreros a la misma
 * persona solo porque los declara.
 *
 * 1. Tag exacto, un asiento por agente. Etiquetar siempre gana.
 * 2. Respaldo por texto libre para los que no traen tag, también un asiento
 *    por agente. Los catálogos que ya existen siguen funcionando sin tocarlos.
 * 3. Huecos que quedan: un agente que **declara** ese rol y ya tiene asiento
 *    lo cubre como segundo sombrero (`via: 'double'`). Solo declarado: doblar
 *    a alguien por una corazonada del texto libre sería inventarse cobertura.
 */
/**
 * Emparejamiento máximo asiento↔agente (caminos aumentantes, Kuhn).
 * Devuelve, por asiento, el índice del agente que lo ocupa o null.
 *
 * Recorrer la lista y quedarse con el primero que encaja NO sirve: con
 * `[TechLead(architect,dev,qa), PO, Dev, QA]` el Tech Lead pasa antes y se
 * queda el asiento de QA, dejando fuera a la QA de verdad. El emparejamiento
 * exacto reparte y además garantiza la cobertura máxima, que es justo lo que
 * la UI afirma con «3 de 3». Los tamaños son minúsculos —8 roles como mucho—,
 * así que el coste no es un tema.
 */
function matchSeatsToAgents(
  seatRoles: readonly CeremonyRoleId[],
  agents: readonly CeremonyRoleCandidate[],
  eligible: (agent: CeremonyRoleCandidate, role: CeremonyRoleId) => boolean,
): Array<number | null> {
  const seatAgent: Array<number | null> = seatRoles.map(() => null)
  const agentSeat = new Map<number, number>()

  /**
   * Índices de agente, del más específico al más generalista. Entre dos
   * repartos igual de completos queremos el que sienta al que solo hace ese
   * rol: con [TechLead(architect,dev,qa), PO, Dev, QA] el asiento de dev es
   * de David, no del Tech Lead.
   */
  const order = agents
    .map((agent, index) => ({
      index,
      breadth: candidateCeremonyRoles(agent).length || Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.breadth - b.breadth || a.index - b.index)
    .map(entry => entry.index)

  const assign = (seatIndex: number, visited: Set<number>): boolean => {
    const role = seatRoles[seatIndex]
    if (!role) return false
    for (const a of order) {
      const agent = agents[a]
      if (!agent || visited.has(a) || !eligible(agent, role)) continue
      visited.add(a)
      const held = agentSeat.get(a)
      // Libre, o su ocupante actual puede reacomodarse en otro asiento.
      if (held === undefined || assign(held, visited)) {
        agentSeat.set(a, seatIndex)
        seatAgent[seatIndex] = a
        return true
      }
    }
    return false
  }

  for (let seat = 0; seat < seatRoles.length; seat += 1) {
    assign(seat, new Set<number>())
  }
  return seatAgent
}

export function ceremonyRoleCoverage(
  ceremonyId: unknown,
  agents: readonly CeremonyRoleCandidate[],
): CeremonyRoleSeat[] {
  const ceremony = ceremonyById(ceremonyId)

  // 1. Tag declarado. Emparejamiento exacto: reparte y cubre lo máximo posible.
  const tagged = matchSeatsToAgents(
    ceremony.roles,
    agents,
    (agent, role) => candidateCeremonyRoles(agent).includes(role),
  )
  const seats: CeremonyRoleSeat[] = ceremony.roles.map((role, index) => {
    const at = tagged[index]
    const agent = at === null || at === undefined ? undefined : agents[at]
    return { role, agentId: agent?.id ?? null, via: agent ? 'tag' : null }
  })
  const taken = new Set(seats.map(seat => seat.agentId).filter((id): id is string => Boolean(id)))

  // 2. Respaldo por texto libre, solo para quienes no traen tag.
  const openIndexes = seats
    .map((seat, index) => (seat.agentId ? -1 : index))
    .filter(index => index >= 0)
  if (openIndexes.length) {
    const untagged = agents.filter(agent => (
      !taken.has(agent.id) && !candidateCeremonyRoles(agent).length
    ))
    const guessed = matchSeatsToAgents(
      openIndexes.map(index => seats[index]!.role),
      untagged,
      guessesRole,
    )
    openIndexes.forEach((seatIndex, slot) => {
      const at = guessed[slot]
      const agent = at === null || at === undefined ? undefined : untagged[at]
      if (!agent) return
      seats[seatIndex]!.agentId = agent.id
      seats[seatIndex]!.via = 'guess'
      taken.add(agent.id)
    })
  }

  // 3. Segundo sombrero: los huecos que quedan los tapa alguien ya sentado que
  //    DECLARA el rol. Se elige al que menos asientos lleva, para no apilar
  //    tres sombreros en uno cuando dos pueden repartírselos.
  for (const seat of seats) {
    if (seat.agentId) continue
    const seatCount = (id: string): number =>
      seats.filter(other => other.agentId === id).length
    const second = agents
      .filter(agent => taken.has(agent.id) && candidateCeremonyRoles(agent).includes(seat.role))
      .sort((a, b) => seatCount(a.id) - seatCount(b.id))[0]
    if (!second) continue
    seat.agentId = second.id
    seat.via = 'double'
  }
  return seats
}

/**
 * Los asientos que un agente ocupa en esta ceremonia, en orden de catálogo.
 * Con dos o más, el turno tiene que decírselo: si no, la sala afirma que el
 * rol está cubierto y nadie habla por él.
 */
export function ceremonyRolesForAgent(
  ceremonyId: unknown,
  agents: readonly CeremonyRoleCandidate[],
  agentId: string,
): CeremonyRoleId[] {
  const id = agentId.trim()
  if (!id) return []
  return ceremonyRoleCoverage(ceremonyId, agents)
    .filter(seat => seat.agentId === id)
    .map(seat => seat.role)
}

const NONE_VALUE = /^(?:none|no|nope|nada|ninguna|ninguno|n\/a|0|-|—)\.?$/i

/** «none», «ninguna», vacío: el hueco está cerrado. */
export function isEmptyClosingValue(value: string | undefined): boolean {
  const text = value?.trim() ?? ''
  if (!text) return true
  return NONE_VALUE.test(text)
}

export type CeremonyGateState = 'open' | 'closed' | 'unknown'

/**
 * Estado del gate a partir de los campos del cierre.
 * `unknown` = la ceremonia no define campo de gate o el turno final no lo escribió.
 */
export function ceremonyGateState(
  ceremonyId: unknown,
  fields: Readonly<Record<string, string>>,
): CeremonyGateState {
  const ceremony = ceremonyById(ceremonyId)
  const field = ceremony.gate?.field
  if (!field) return 'unknown'
  const spec = ceremony.closing.find(item => item.label === field)
  if (!spec) return 'unknown'
  if (!(spec.key in fields)) return 'unknown'
  return isEmptyClosingValue(fields[spec.key]) ? 'closed' : 'open'
}

/** Un gate abierto solo bloquea si la ceremonia lo declaró bloqueante. */
export function ceremonyBlocksAiReady(
  ceremonyId: unknown,
  fields: Readonly<Record<string, string>>,
): boolean {
  const ceremony = ceremonyById(ceremonyId)
  if (!ceremony.gate?.blocking) return false
  return ceremonyGateState(ceremonyId, fields) === 'open'
}

/**
 * Lee la línea `AI-Ready gaps` y devuelve los campos que faltan.
 * Solo claves conocidas: lo que el modelo invente se descarta.
 */
export function parseAiReadyGaps(raw: string | undefined): AiReadyField[] {
  if (isEmptyClosingValue(raw)) return []
  const wanted = new Map(AI_READY_FIELDS.map(field => [slug(field), field]))
  const out: AiReadyField[] = []
  for (const token of (raw ?? '').split(/[,;·]+/)) {
    const field = wanted.get(slug(token))
    if (field && !out.includes(field)) out.push(field)
  }
  return out
}

/** Checklist AI-Ready listo para pintar: los 11 campos con su estado. */
export function aiReadyChecklist(
  gaps: readonly AiReadyField[],
): Array<{ field: AiReadyField; ok: boolean; blocking: boolean }> {
  return AI_READY_FIELDS.map(field => ({
    field,
    ok: !gaps.includes(field),
    blocking: field === AI_READY_BLOCKING_FIELD,
  }))
}
