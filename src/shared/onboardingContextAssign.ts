export type ContextAssignOutcome = 'added' | 'already' | 'removed' | 'rejected'

export function resolveContextAssignOutcome(args: {
  currentIds?: readonly string[] | null
  contextId: string
  ownResult: boolean
  mode: 'assign' | 'toggle'
}): ContextAssignOutcome {
  if (args.contextId.trim() === '') {
    return 'rejected'
  }

  const present = (args.currentIds ?? []).includes(args.contextId)

  if (args.mode === 'toggle' && present) {
    return 'removed'
  }

  if (args.ownResult) {
    return 'rejected'
  }

  if (args.mode === 'assign' && present) {
    return 'already'
  }

  return 'added'
}

/** 'already' persiste porque el usuario sí tiene contexto asignado y onboardingAssignedContext debe quedar en true aunque el drop no cambie nada. */
export function shouldPersistAssignedContext(outcome: ContextAssignOutcome): boolean {
  return outcome === 'added' || outcome === 'already'
}
