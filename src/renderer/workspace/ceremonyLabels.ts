import type {
  AiReadyField,
  CeremonyId,
  CeremonyRoleId,
  CeremonyStage,
} from '@shared/agileCeremonies'

/** Etiquetas de los roles de ceremonia; viven en la sección `agentPane`
 *  porque es la ficha del agente la que los declara. */
export const CEREMONY_ROLE_KEY = {
  productOwner: 'agentPane.ceremonyRoleProductOwner',
  domainExpert: 'agentPane.ceremonyRoleDomainExpert',
  architect: 'agentPane.ceremonyRoleArchitect',
  dev: 'agentPane.ceremonyRoleDev',
  qa: 'agentPane.ceremonyRoleQa',
  ux: 'agentPane.ceremonyRoleUx',
  stakeholder: 'agentPane.ceremonyRoleStakeholder',
  scrumMaster: 'agentPane.ceremonyRoleScrumMaster',
} as const satisfies Record<CeremonyRoleId, string>

/**
 * Claves i18n de cada ceremonia. Literales y no plantillas: `t()` está tipado
 * contra `locales/en`, así una clave inventada no compila. Mismo patrón que
 * `statusLabelKey` en la lista de salas.
 */
export const CEREMONY_GOAL_KEY = {
  free: 'tabs.ceremonyGoalFree',
  eventStorming: 'tabs.ceremonyGoalEventStorming',
  userStoryMapping: 'tabs.ceremonyGoalUserStoryMapping',
  impactMapping: 'tabs.ceremonyGoalImpactMapping',
  oopsiMapping: 'tabs.ceremonyGoalOopsiMapping',
  threeAmigos: 'tabs.ceremonyGoalThreeAmigos',
  exampleMapping: 'tabs.ceremonyGoalExampleMapping',
  featureMapping: 'tabs.ceremonyGoalFeatureMapping',
  specificationWorkshop: 'tabs.ceremonyGoalSpecificationWorkshop',
  backlogRefinement: 'tabs.ceremonyGoalBacklogRefinement',
  sprintPlanning: 'tabs.ceremonyGoalSprintPlanning',
} as const satisfies Record<CeremonyId, string>

/** `free` no tiene gate: su celda es la única ausente a propósito. */
export const CEREMONY_GATE_KEY = {
  eventStorming: 'tabs.ceremonyGateEventStorming',
  userStoryMapping: 'tabs.ceremonyGateUserStoryMapping',
  impactMapping: 'tabs.ceremonyGateImpactMapping',
  oopsiMapping: 'tabs.ceremonyGateOopsiMapping',
  threeAmigos: 'tabs.ceremonyGateThreeAmigos',
  exampleMapping: 'tabs.ceremonyGateExampleMapping',
  featureMapping: 'tabs.ceremonyGateFeatureMapping',
  specificationWorkshop: 'tabs.ceremonyGateSpecificationWorkshop',
  backlogRefinement: 'tabs.ceremonyGateBacklogRefinement',
  sprintPlanning: 'tabs.ceremonyGateSprintPlanning',
} as const satisfies Partial<Record<CeremonyId, string>>

export const CEREMONY_STAGE_KEY = {
  free: 'tabs.ceremonyStageFree',
  discovery: 'tabs.ceremonyStageDiscovery',
  align: 'tabs.ceremonyStageAlign',
  spec: 'tabs.ceremonyStageSpec',
  deliver: 'tabs.ceremonyStageDeliver',
} as const satisfies Record<CeremonyStage, string>

export const AI_READY_FIELD_KEY = {
  story: 'tabs.ceremonyAiReadyStory',
  ears: 'tabs.ceremonyAiReadyEars',
  rules: 'tabs.ceremonyAiReadyRules',
  gherkin: 'tabs.ceremonyAiReadyGherkin',
  positive: 'tabs.ceremonyAiReadyPositive',
  negative: 'tabs.ceremonyAiReadyNegative',
  deps: 'tabs.ceremonyAiReadyDeps',
  'test-data': 'tabs.ceremonyAiReadyTestData',
  nfr: 'tabs.ceremonyAiReadyNfr',
  dor: 'tabs.ceremonyAiReadyDor',
  questions: 'tabs.ceremonyAiReadyQuestions',
} as const satisfies Record<AiReadyField, string>

export function ceremonyGateKey(id: CeremonyId): typeof CEREMONY_GATE_KEY[keyof typeof CEREMONY_GATE_KEY] | null {
  return id in CEREMONY_GATE_KEY
    ? CEREMONY_GATE_KEY[id as keyof typeof CEREMONY_GATE_KEY]
    : null
}
