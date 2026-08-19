import { describe, expect, it } from 'vitest'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import {
  resolveContextAssignOutcome,
  shouldPersistAssignedContext,
} from '@shared/onboardingContextAssign'
import { isDismissibleGuideStep } from '@shared/onboardingGuideFlow'

/** Replica el guard de handleAssignContextToAgent en App.tsx. */
function shouldPersistAssignDrop(args: {
  priorIds: readonly string[]
  contextId: string
  agentId: string
  metaChangeOk: boolean
}): boolean {
  if (!args.metaChangeOk) return false
  const outcome = resolveContextAssignOutcome({
    currentIds: args.priorIds,
    contextId: args.contextId,
    ownResult: args.contextId === agentResultContextIdForSlug(args.agentId),
    mode: 'assign',
  })
  return shouldPersistAssignedContext(outcome)
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
  if (!shouldPersistAssignedContext(outcome)) return false
  if (outcome === 'already') return true
  return args.catalogWriteOk
}

/** Replica el guard de handleToggleAgentContext en App.tsx. */
function shouldPersistToggle(args: {
  currentIds: readonly string[]
  contextId: string
  agentId: string
  metaChangeOk: boolean
}): boolean {
  if (!args.metaChangeOk) return false
  const outcome = resolveContextAssignOutcome({
    currentIds: args.currentIds,
    contextId: args.contextId,
    ownResult: args.contextId === agentResultContextIdForSlug(args.agentId),
    mode: 'toggle',
  })
  return shouldPersistAssignedContext(outcome)
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

  it('(g) pane drop with a failed meta change does not persist assignedContext', () => {
    expect(
      shouldPersistAssignDrop({
        priorIds: ['ctx-a'],
        contextId: 'ctx-b',
        agentId: 'fullstack',
        metaChangeOk: false,
      }),
    ).toBe(false)
  })

  it('(h) toggle with a failed meta change does not persist assignedContext', () => {
    expect(
      shouldPersistToggle({
        currentIds: [],
        contextId: 'ctx-b',
        agentId: 'fullstack',
        metaChangeOk: false,
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

  it('pane drop of context already present (priorIds includes contextId, metaChangeOk true) persists assignedContext', () => {
    expect(
      shouldPersistAssignDrop({
        priorIds: ['ctx-a'],
        contextId: 'ctx-a',
        agentId: 'fullstack',
        metaChangeOk: true,
      }),
    ).toBe(true)
  })

  it('catalog drop of context already present with catalogWriteOk false persists assignedContext', () => {
    expect(
      shouldPersistCatalogDrop({
        currentIds: ['ctx-a'],
        contextId: 'ctx-a',
        agentId: 'fullstack',
        catalogWriteOk: false,
      }),
    ).toBe(true)
  })

  it('catalog drop of agent own agentResult context with catalogWriteOk true does not persist assignedContext', () => {
    const ownResult = agentResultContextIdForSlug('fullstack')
    expect(
      shouldPersistCatalogDrop({
        currentIds: [],
        contextId: ownResult,
        agentId: 'fullstack',
        catalogWriteOk: true,
      }),
    ).toBe(false)
  })

  it('toggle removing a present context (mode toggle, outcome removed) does not persist assignedContext', () => {
    expect(
      shouldPersistToggle({
        currentIds: ['ctx-a', 'ctx-b'],
        contextId: 'ctx-b',
        agentId: 'fullstack',
        metaChangeOk: true,
      }),
    ).toBe(false)
  })

  it('pane drop with empty contextId does not persist assignedContext', () => {
    expect(
      shouldPersistAssignDrop({
        priorIds: ['ctx-a'],
        contextId: '',
        agentId: 'fullstack',
        metaChangeOk: true,
      }),
    ).toBe(false)
  })

  it('dismiss on non-dismissible action step returns null; dismiss on dismissible step already in doneSteps returns null', () => {
    expect(
      resolveGuideDismissWrite({
        step: 'choose_path',
        doneSteps: [],
      }),
    ).toBeNull()
    expect(
      resolveGuideDismissWrite({
        step: 'assign_context',
        doneSteps: ['saved_rooms', 'assign_context'],
      }),
    ).toBeNull()
  })
})
