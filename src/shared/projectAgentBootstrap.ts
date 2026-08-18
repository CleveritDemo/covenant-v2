import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  sanitizeAgentMonogram,
  sanitizeAgentRulesDraft,
  sanitizeAgentTextDraft,
} from './agentIdentity'
import {
  sanitizeCeremonyRoleId,
  sanitizeCeremonyRoleIds,
  type CeremonyRoleId,
} from './agileCeremonies'
import {
  persistableDelegateTo,
  sanitizeOrchestrationMaxRounds,
  sanitizeOrchestrationWorkStyle,
  type AgentCoordination,
  type OrchestrationWorkStyle,
} from './agentOrchestration'
import {
  allocateAgentSlug,
  buildNewProjectAgentDefinition,
  isAgentCliProvider,
  type AgentCliProvider,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'

/** Spec portable de un agente del pack de bootstrap. */
export interface ProjectAgentBootstrapSpec {
  idHint: string
  name: string
  /** Monograma de la cara; sin él se derivaría "BA" de "Backend". */
  monogram?: string
  role: string
  objective: string
  provider?: AgentCliProvider
  model?: string
  rules?: readonly string[]
  contextIds?: readonly string[]
  order?: number
  coordination?: AgentCoordination
  orchestrationMaxRounds?: number
  orchestrationWorkStyle?: OrchestrationWorkStyle
  ceremonyRoles?: readonly CeremonyRoleId[]
  ceremonyRole?: CeremonyRoleId
  acceptDelegations?: boolean
}

const TL_RULES: readonly string[] = [
  'realiza una inspección exhaustiva del código afectado y  los flujos antes de delegar a dev',
  'en las delegaciones a los devs debes dar instrucciones exactas sobre qué debe hacer el dev. no deleges a un dev investigación. el dev hace exactamente lo que pides, no piensa qué hacer.',
  'delega a qa después de una modificación que involucre código y haya sido estructural y de lógica importante. a los qa indícale qué archivos y qué features probar, pero no le indiques código',
  'en caso de usar qa, entregale al menos 5 flujos de uso que deben cumplirse',
]

const TL_TURBO_RULES: readonly string[] = [
  'realiza una inspección exhaustiva del código afectado y  los flujos antes de delegar a dev',
  'en las delegaciones a los devs debes dar instrucciones exactas sobre qué debe hacer el dev. no deleges a un dev investigación. el dev hace exactamente lo que pides, no piensa qué hacer.',
  'prioriza multiples delegaciones y no usar qa a menos que sea estrictamente necesario',
  'en caso de usar qa, entregale al menos 5 flujos de uso que deben cumplirse',
]

const QA_RULES: readonly string[] = [
  'Cite file and line for every finding.',
  'Separate what is wrong from what you would do differently.',
  'Do not edit code: report.',
]

const ORCHESTRATOR_CONTEXT_IDS: readonly string[] = [
  'iaterminal:notes:Front-Rules',
  'iaterminal:notes:Workspace-logic',
  'iaterminal:changelog:AI-Changelog',
  'iaterminal:notes:Front-Production-release',
  'iaterminal:notes:About-Covenant-Gravoty',
  'iaterminal:notes:About-neural-wiki',
  'iaterminal:result:backend',
  'iaterminal:result:frontend',
  'iaterminal:result:qa',
]

/** Pack Covenant: orquestadores, devs, diseño, QA y PO — nombres de rol, no de persona. */
export const DEFAULT_PROJECT_AGENT_PACK: readonly ProjectAgentBootstrapSpec[] = [
  {
    idHint: 'tl',
    name: 'Tech Lead',
    monogram: 'TL',
    role: 'technical leader',
    objective:
      'Turn user goals into concrete technical delegations. Coordinate specialists; do not implement large changes yourself.',
    provider: 'claude',
    model: 'claude-fable-5',
    rules: TL_RULES,
    contextIds: ORCHESTRATOR_CONTEXT_IDS,
    order: 0,
    coordination: 'orchestrator',
    orchestrationMaxRounds: 0,
  },
  {
    idHint: 'tech-lead-copy',
    name: 'TL Turbo',
    monogram: 'TL',
    role: 'technical leader',
    objective:
      'Turn user goals into concrete technical delegations. Coordinate specialists; do not implement large changes yourself.',
    provider: 'claude',
    rules: TL_TURBO_RULES,
    contextIds: ORCHESTRATOR_CONTEXT_IDS,
    order: 1,
    coordination: 'orchestrator',
    orchestrationMaxRounds: 0,
    orchestrationWorkStyle: 'turbo',
  },
  {
    idHint: 'frontend',
    name: 'Frontend',
    monogram: 'FE',
    role: 'frontend engineer',
    objective:
      'Implement UI with clean components, accessibility, and clear interaction patterns.',
    provider: 'cursor',
    contextIds: [
      'iaterminal:folderTree:Front-folders',
      'iaterminal:notes:Deisgn-Language',
      'iaterminal:notes:Front-Rules',
      'iaterminal:symbols:Front-CM',
      'iaterminal:notes:Front-Production-release',
      'iaterminal:result:qa',
    ],
    order: 2,
    acceptDelegations: true,
  },
  {
    idHint: 'backend',
    name: 'Backend',
    monogram: 'BE',
    role: 'backend engineer',
    objective:
      'Implement API and server-side logic with clear contracts, persistence, and safe defaults.',
    provider: 'cursor',
    model: 'composer-2.5',
    contextIds: [
      'iaterminal:folderTree:Back-Folders',
      'iaterminal:symbols:Back-CM',
      'iaterminal:result:qa',
    ],
    order: 3,
    acceptDelegations: true,
  },
  {
    idHint: 'qa',
    name: 'QA',
    monogram: 'QA',
    role: 'qa expert',
    objective:
      'Review the pending changes and report what breaks, what is missing, and what can be deleted—no rewrites of your own.',
    provider: 'copilot',
    model: 'gpt-5.5',
    rules: QA_RULES,
    contextIds: [
      'iaterminal:notes:Front-Rules',
      'iaterminal:notes:Deisgn-Language',
      'iaterminal:notes:Workspace-logic',
    ],
    order: 4,
    acceptDelegations: true,
  },
  {
    idHint: 'product-designer',
    name: 'Product Designer',
    monogram: 'PD',
    role: 'product designer and researcher',
    objective:
      'your objective is to understand the product. know who is it for, what are the use cases and find ways to improve',
    provider: 'cursor',
    contextIds: ['iaterminal:notes:About-Covenant-Gravoty'],
    order: 5,
    acceptDelegations: false,
  },
  {
    idHint: 'product-owner',
    name: 'Product Owner',
    role: 'Product Owner',
    objective: 'tu misión es trabajar sin descanso delegando al techleader lo que requiera el usuario',
    provider: 'cursor',
    ceremonyRoles: ['productOwner'],
    ceremonyRole: 'productOwner',
    order: 6,
    coordination: 'productOwner',
    orchestrationMaxRounds: 0,
    acceptDelegations: false,
  },
]

function sanitizeBootstrapContextIds(raw: readonly string[] | undefined): string[] | undefined {
  if (!raw?.length) return undefined
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of raw) {
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    next.push(trimmed)
  }
  return next.length ? next : undefined
}

function resolveBootstrapProvider(
  spec: ProjectAgentBootstrapSpec,
  fallback: AgentCliProvider,
): AgentCliProvider {
  const candidate = spec.provider
  return candidate && isAgentCliProvider(candidate) ? candidate : fallback
}

/**
 * Construye definiciones del pack: buildNew + overlay identity/coordination.
 * Ids vía allocateAgentSlug(idHint). Orquestadores reciben delegateTo a devs/QA.
 */
export function buildBootstrapProjectAgentDefinitions(
  provider: AgentCliProvider,
  existingIds: ReadonlySet<string> = new Set(),
  pack: readonly ProjectAgentBootstrapSpec[] = DEFAULT_PROJECT_AGENT_PACK,
): ProjectAgentDefinition[] {
  const taken = new Set(existingIds)
  const defs: ProjectAgentDefinition[] = []

  for (const spec of pack) {
    const specProvider = resolveBootstrapProvider(spec, provider)
    const draft = buildNewProjectAgentDefinition(specProvider, spec.name, taken)
    const id = allocateAgentSlug(spec.idHint, taken)
    taken.add(id)

    const name = sanitizeAgentTextDraft(spec.name, AGENT_NAME_MAX_LENGTH)
    const monogram = sanitizeAgentMonogram(spec.monogram)
    const role = sanitizeAgentTextDraft(spec.role, AGENT_ROLE_MAX_LENGTH)
    const objective = sanitizeAgentTextDraft(spec.objective, AGENT_OBJECTIVE_MAX_LENGTH)
    const rules = sanitizeAgentRulesDraft(spec.rules)
    const contextIds = sanitizeBootstrapContextIds(spec.contextIds)
    const ceremonyRoles = sanitizeCeremonyRoleIds(spec.ceremonyRoles)
    const ceremonyRole = sanitizeCeremonyRoleId(spec.ceremonyRole)
    const orchestrationMaxRounds = sanitizeOrchestrationMaxRounds(spec.orchestrationMaxRounds)
    const orchestrationWorkStyle = sanitizeOrchestrationWorkStyle(spec.orchestrationWorkStyle)
    const model = spec.model?.trim()

    const def: ProjectAgentDefinition = {
      ...draft,
      id,
      provider: specProvider,
      ...(name ? { name } : {}),
      ...(monogram ? { monogram } : {}),
      ...(role ? { role } : {}),
      ...(objective ? { objective } : {}),
      ...(model ? { model } : {}),
      ...(rules?.length ? { rules } : {}),
      ...(contextIds ? { contextIds } : {}),
      ...(typeof spec.order === 'number' && Number.isFinite(spec.order)
        ? { order: spec.order }
        : {}),
    }

    if (spec.coordination === 'orchestrator' || spec.coordination === 'productOwner') {
      def.coordination = spec.coordination
    }
    if (orchestrationMaxRounds !== undefined) {
      def.orchestrationMaxRounds = orchestrationMaxRounds
    }
    if (orchestrationWorkStyle) {
      def.orchestrationWorkStyle = orchestrationWorkStyle
    }
    if (ceremonyRoles.length) {
      def.ceremonyRoles = ceremonyRoles
      def.ceremonyRole = ceremonyRoles[0]
    } else if (ceremonyRole) {
      def.ceremonyRole = ceremonyRole
      def.ceremonyRoles = [ceremonyRole]
    }
    if (spec.acceptDelegations === false) {
      def.acceptDelegations = false
    }

    defs.push(def)
  }

  const delegateTargetIds = defs
    .filter(item => item.coordination !== 'orchestrator' && item.coordination !== 'productOwner')
    .filter(item => item.acceptDelegations !== false)
    .map(item => item.id)

  for (const def of defs) {
    if (def.coordination !== 'orchestrator' || !delegateTargetIds.length) continue
    const delegateTo = persistableDelegateTo('orchestrator', { agentIds: delegateTargetIds })
    if (delegateTo) def.delegateTo = delegateTo
    else def.delegateTo = { agentIds: delegateTargetIds }
  }

  return defs
}
