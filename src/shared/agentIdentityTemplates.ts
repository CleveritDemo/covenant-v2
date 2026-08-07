/**
 * Plantillas de identidad para agentes nuevos.
 *
 * Solo claves de i18n: el texto vive en `src/i18n/locales/*` porque el usuario
 * lo lee y lo edita antes de que llegue al modelo. La UI las ofrece cuando el
 * objetivo y las reglas están vacíos, así que aplicar una nunca pisa nada.
 */
/** `as const`: las claves quedan como literales y `t()` las acepta tipadas. */
export const AGENT_IDENTITY_TEMPLATES = [
  {
    id: 'techLead',
    labelKey: 'agentPane.templateTechLeadLabel',
    roleKey: 'agentPane.templateTechLeadRole',
    objectiveKey: 'agentPane.templateTechLeadObjective',
    ruleKeys: [
      'agentPane.templateTechLeadRule1',
      'agentPane.templateTechLeadRule2',
      'agentPane.templateTechLeadRule3',
    ],
  },
  {
    id: 'reviewer',
    labelKey: 'agentPane.templateReviewerLabel',
    roleKey: 'agentPane.templateReviewerRole',
    objectiveKey: 'agentPane.templateReviewerObjective',
    ruleKeys: [
      'agentPane.templateReviewerRule1',
      'agentPane.templateReviewerRule2',
      'agentPane.templateReviewerRule3',
    ],
  },
  {
    id: 'implementer',
    labelKey: 'agentPane.templateImplementerLabel',
    roleKey: 'agentPane.templateImplementerRole',
    objectiveKey: 'agentPane.templateImplementerObjective',
    ruleKeys: [
      'agentPane.templateImplementerRule1',
      'agentPane.templateImplementerRule2',
      'agentPane.templateImplementerRule3',
    ],
  },
] as const

export type AgentIdentityTemplate = (typeof AGENT_IDENTITY_TEMPLATES)[number]
