import { describe, expect, it } from 'vitest'
import { DISMISSIBLE_GUIDE_STEPS } from '../onboardingGuideFlow'

type SignalWrite = {
  assignedContext?: boolean
  guideDone?: string[]
  sentFirstMessage?: boolean
}

function isBlankContextId(contextId?: string): boolean {
  return !contextId || contextId.trim() === ''
}

function resolveSignalWrite(input: {
  event: 'assign_drop' | 'assign_drop_catalog' | 'toggle' | 'guide_dismiss' | 'send_message'
  currentIds?: readonly string[]
  contextId?: string
  ownResult?: boolean
  catalogWriteOk?: boolean
  step?: string
  dismissibleSteps?: readonly string[]
  doneSteps?: readonly string[]
  composerSendBlock?: 'none' | 'cli' | 'engine'
}): SignalWrite {
  const { event } = input

  if (event === 'send_message') {
    if (input.composerSendBlock === 'none') {
      return { sentFirstMessage: true }
    }
    return {}
  }

  if (event === 'guide_dismiss') {
    const step = input.step
    const dismissibleSteps = input.dismissibleSteps ?? []
    const doneSteps = input.doneSteps ?? []
    if (!step) return {}
    if (!dismissibleSteps.includes(step)) return {}
    if (doneSteps.includes(step)) return {}
    return { guideDone: [...doneSteps, step] }
  }

  if (isBlankContextId(input.contextId)) {
    return {}
  }

  const contextId = input.contextId!
  const currentIds = input.currentIds ?? []

  if (event === 'toggle') {
    if (currentIds.includes(contextId)) {
      return {}
    }
    if (input.ownResult) {
      return {}
    }
    return { assignedContext: true }
  }

  if (event === 'assign_drop' || event === 'assign_drop_catalog') {
    if (input.ownResult) {
      return {}
    }
    if (event === 'assign_drop_catalog' && input.catalogWriteOk !== true) {
      return {}
    }
    return { assignedContext: true }
  }

  return {}
}

describe('onboarding signals matrix', () => {
  it('assign_drop writes assignedContext when a new foreign context is added', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop',
        currentIds: ['ctx-a'],
        contextId: 'ctx-b',
        ownResult: false,
      }),
    ).toEqual({ assignedContext: true })
  })

  it('assign_drop does not write when the agent own result context is rejected', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop',
        currentIds: [],
        contextId: 'agent-result',
        ownResult: true,
      }),
    ).toEqual({})
  })

  it('assign_drop writes assignedContext when the context was already assigned', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop',
        currentIds: ['ctx-a', 'ctx-b'],
        contextId: 'ctx-a',
        ownResult: false,
      }),
    ).toEqual({ assignedContext: true })
  })

  it('assign_drop_catalog writes assignedContext only when catalog write succeeds', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop_catalog',
        currentIds: [],
        contextId: 'ctx-new',
        ownResult: false,
        catalogWriteOk: true,
      }),
    ).toEqual({ assignedContext: true })
  })

  it('assign_drop_catalog does not write when catalog write fails', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop_catalog',
        currentIds: [],
        contextId: 'ctx-new',
        ownResult: false,
        catalogWriteOk: false,
      }),
    ).toEqual({})
  })

  it('toggle does not write when deselecting even if other contexts remain', () => {
    expect(
      resolveSignalWrite({
        event: 'toggle',
        currentIds: ['ctx-a', 'ctx-b'],
        contextId: 'ctx-a',
        ownResult: false,
      }),
    ).toEqual({})
  })

  it('toggle writes assignedContext when selecting a foreign context', () => {
    expect(
      resolveSignalWrite({
        event: 'toggle',
        currentIds: ['ctx-a'],
        contextId: 'ctx-b',
        ownResult: false,
      }),
    ).toEqual({ assignedContext: true })
  })

  it('toggle does not write when selecting the agent own result context', () => {
    expect(
      resolveSignalWrite({
        event: 'toggle',
        currentIds: [],
        contextId: 'agent-result',
        ownResult: true,
      }),
    ).toEqual({})
  })

  it('guide_dismiss appends dismissible assign_context to guideDone', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'assign_context',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: ['open_terminal'],
      }),
    ).toEqual({ guideDone: ['open_terminal', 'assign_context'] })
  })

  it('guide_dismiss appends dismissible saved_rooms to guideDone', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'saved_rooms',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: [],
      }),
    ).toEqual({ guideDone: ['saved_rooms'] })
  })

  it('guide_dismiss does not write guideDone for action step choose_path', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'choose_path',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: [],
      }),
    ).toEqual({})
  })

  it('guide_dismiss does not write guideDone for action step pick_folder', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'pick_folder',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: [],
      }),
    ).toEqual({})
  })

  it('guide_dismiss does not write guideDone for action step send_message', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'send_message',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: [],
      }),
    ).toEqual({})
  })

  it('guide_dismiss does not write when the step is already in doneSteps', () => {
    expect(
      resolveSignalWrite({
        event: 'guide_dismiss',
        step: 'assign_context',
        dismissibleSteps: DISMISSIBLE_GUIDE_STEPS,
        doneSteps: ['assign_context'],
      }),
    ).toEqual({})
  })

  it('send_message writes sentFirstMessage when composer send block is none', () => {
    expect(
      resolveSignalWrite({
        event: 'send_message',
        composerSendBlock: 'none',
      }),
    ).toEqual({ sentFirstMessage: true })
  })

  it('send_message does not write when composer send block is cli', () => {
    expect(
      resolveSignalWrite({
        event: 'send_message',
        composerSendBlock: 'cli',
      }),
    ).toEqual({})
  })

  it('send_message does not write when composer send block is engine', () => {
    expect(
      resolveSignalWrite({
        event: 'send_message',
        composerSendBlock: 'engine',
      }),
    ).toEqual({})
  })

  it('blank contextId does not write assignedContext on assign_drop', () => {
    expect(
      resolveSignalWrite({
        event: 'assign_drop',
        currentIds: [],
        contextId: '',
        ownResult: false,
      }),
    ).toEqual({})
  })

  it('whitespace-only contextId does not write on toggle', () => {
    expect(
      resolveSignalWrite({
        event: 'toggle',
        currentIds: [],
        contextId: '   ',
        ownResult: false,
      }),
    ).toEqual({})
  })
})
