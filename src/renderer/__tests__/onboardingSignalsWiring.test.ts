import { describe, expect, it } from 'vitest'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { resolveContextAssignOutcome } from '@shared/onboardingContextAssign'
import { isDismissibleGuideStep } from '@shared/onboardingGuideFlow'

/** Replica el guard de handleAssignContextToAgent en App.tsx. */
function shouldPersistAssignDrop(args: {
  priorIds: readonly string[]
  contextId: string
  agentId: string
  assignmentOccurred: boolean
  metaChangeOk: boolean
}): boolean {
  if (!args.metaChangeOk || !args.assignmentOccurred) return false
  const outcome = resolveContextAssignOutcome({
    currentIds: args.priorIds,
    contextId: args.contextId,
    ownResult: args.contextId === agentResultContextIdForSlug(args.agentId),
    mode: 'assign',
  })
  return outcome === 'added'
}

/** Replica el guard de handleAssignContextToCatalogAgent en App.tsx. */
function shouldPersistCatalogDrop(args: {
  currentIds: readonly string[]
  contextId: string
  agentId: string
  catalogWriteOk: boolean
}): boolean {
  const outcome = resolveContextAssignOutcome({
    currentIds: args.currentIds,
    contextId: args.contextId,
    ownResult: args.contextId === agentResultContextIdForSlug(args.agentId),
    mode: 'assign',
  })
  if (outcome === 'rejected') return false
  return args.catalogWriteOk
}

/** Replica el guard de handleToggleAgentContext en App.tsx. */
function shouldPersistToggle(args: {
  currentIds: readonly string[]
  contextId: string
  agentId: string
  metaChangeOk: boolean
}): boolean {
  const outcome = resolveContextAssignOutcome({
    currentIds: args.currentIds,
    contextId: args.contextId,
    ownResult: args.contextId === agentResultContextIdForSlug(args.agentId),
    mode: 'toggle',
  })
  return args.metaChangeOk && outcome === 'added'
}

/** Replica onOnboardingGuideDismiss en App.tsx. */
function resolveGuideDismissWrite(args: {
  step: string
  doneSteps: readonly string[]
}): string[] | null {
  if (!isDismissibleGuideStep(args.step)) return null
  if (args.doneSteps.includes(args.step)) return null
  return [...args.doneSteps, args.step]
}

describe('onboarding signals wiring', () => {
  it('(a) assigning a new context persists assignedContext after confirmed meta change', () => {
    expect(
      shouldPersistAssignDrop({
        priorIds: ['ctx-a'],
        contextId: 'ctx-b',
        agentId: 'fullstack',
        assignmentOccurred: true,
        metaChangeOk: true,
      }),
    ).toBe(true)
  })

  it('(b) assigning the agent own result context does not persist assignedContext', () => {
    const ownResult = agentResultContextIdForSlug('fullstack')
    expect(
      shouldPersistAssignDrop({
        priorIds: [],
        contextId: ownResult,
        agentId: 'fullstack',
        assignmentOccurred: false,
        metaChangeOk: true,
      }),
    ).toBe(false)
  })

  it('(c) removing an already assigned context does not persist assignedContext', () => {
    expect(
      shouldPersistToggle({
        currentIds: ['ctx-a'],
        contextId: 'ctx-a',
        agentId: 'fullstack',
        metaChangeOk: true,
      }),
    ).toBe(false)
  })

  it('(d) catalog card drop with failed upsert does not persist assignedContext', () => {
    expect(
      shouldPersistCatalogDrop({
        currentIds: [],
        contextId: 'ctx-new',
        agentId: 'fullstack',
        catalogWriteOk: false,
      }),
    ).toBe(false)
  })

  it('(e) dismiss on a dismissible step appends to guideDone', () => {
    expect(
      resolveGuideDismissWrite({
        step: 'assign_context',
        doneSteps: ['saved_rooms'],
      }),
    ).toEqual(['saved_rooms', 'assign_context'])
  })

  it('(f) dismiss on an action step does not append to guideDone', () => {
    expect(
      resolveGuideDismissWrite({
        step: 'send_message',
        doneSteps: [],
      }),
    ).toBeNull()
  })
})
