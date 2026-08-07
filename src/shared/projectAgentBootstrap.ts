import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  sanitizeAgentMonogram,
  sanitizeAgentTextDraft,
} from './agentIdentity'
import {
  persistableDelegateTo,
  type AgentCoordination,
} from './agentOrchestration'
import {
  allocateAgentSlug,
  buildNewProjectAgentDefinition,
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
  coordination?: AgentCoordination
  acceptDelegations?: boolean
}

/** Pack por defecto: TL + Frontend + Backend + QA. */
export const DEFAULT_PROJECT_AGENT_PACK: readonly ProjectAgentBootstrapSpec[] = [
  {
    idHint: 'tl',
    name: 'Tech Lead',
    monogram: 'TL',
    role: 'technical leader',
    objective:
      'Turn user goals into concrete technical delegations. Coordinate specialists; do not implement large changes yourself.',
    coordination: 'orchestrator',
  },
  {
    idHint: 'frontend',
    name: 'Frontend',
    monogram: 'FE',
    role: 'frontend engineer',
    objective:
      'Implement UI with clean components, accessibility, and clear interaction patterns.',
    acceptDelegations: true,
  },
  {
    idHint: 'backend',
    name: 'Backend',
    monogram: 'BE',
    role: 'backend engineer',
    objective:
      'Implement API and server-side logic with clear contracts, persistence, and safe defaults.',
    acceptDelegations: true,
  },
  {
    idHint: 'qa',
    name: 'QA',
    monogram: 'QA',
    role: 'quality assurance',
    objective:
      'Verify changes with focused checks. Report PASS/FAIL clearly and call out regressions.',
    acceptDelegations: true,
  },
]

/**
 * Construye definiciones del pack: buildNew + overlay identity/coordination.
 * Ids vía allocateAgentSlug(idHint). TL recibe delegateTo a los especialistas creados.
 */
export function buildBootstrapProjectAgentDefinitions(
  provider: AgentCliProvider,
  existingIds: ReadonlySet<string> = new Set(),
  pack: readonly ProjectAgentBootstrapSpec[] = DEFAULT_PROJECT_AGENT_PACK,
): ProjectAgentDefinition[] {
  const taken = new Set(existingIds)
  const defs: ProjectAgentDefinition[] = []

  for (const spec of pack) {
    const draft = buildNewProjectAgentDefinition(provider, spec.name, taken)
    const id = allocateAgentSlug(spec.idHint, taken)
    taken.add(id)

    const name = sanitizeAgentTextDraft(spec.name, AGENT_NAME_MAX_LENGTH)
    const monogram = sanitizeAgentMonogram(spec.monogram)
    const role = sanitizeAgentTextDraft(spec.role, AGENT_ROLE_MAX_LENGTH)
    const objective = sanitizeAgentTextDraft(spec.objective, AGENT_OBJECTIVE_MAX_LENGTH)

    const def: ProjectAgentDefinition = {
      ...draft,
      id,
      ...(name ? { name } : {}),
      ...(monogram ? { monogram } : {}),
      ...(role ? { role } : {}),
      ...(objective ? { objective } : {}),
    }

    if (spec.coordination === 'orchestrator' || spec.coordination === 'productOwner') {
      def.coordination = spec.coordination
    }
    if (spec.acceptDelegations === false) {
      def.acceptDelegations = false
    }

    defs.push(def)
  }

  const tl = defs.find(item => item.coordination === 'orchestrator')
  const specialistIds = defs
    .filter(item => item.coordination !== 'orchestrator' && item.coordination !== 'productOwner')
    .map(item => item.id)
  if (tl && specialistIds.length) {
    const delegateTo = persistableDelegateTo('orchestrator', { agentIds: specialistIds })
    if (delegateTo) tl.delegateTo = delegateTo
    else tl.delegateTo = { agentIds: specialistIds }
  }

  return defs
}
