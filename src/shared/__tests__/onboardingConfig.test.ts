import { describe, expect, it } from 'vitest'
import {
  CONFIG_DEFAULTS,
  mergeWithDefaults,
  sanitizeOnboardingGuideDone,
  validateConfig,
} from '../configSchema'
import { sanitizeOrchestratorPath } from '../onboarding'

describe('onboardingCompletedVersion', () => {
  it('default es string vacío', () => {
    expect(CONFIG_DEFAULTS.onboardingCompletedVersion).toBe('')
    expect(mergeWithDefaults({}).onboardingCompletedVersion).toBe('')
  })

  it('preserva un valor válido', () => {
    expect(mergeWithDefaults({ onboardingCompletedVersion: '1' }).onboardingCompletedVersion).toBe('1')
  })

  it('no-string y string de 40 chars → vacío', () => {
    expect(mergeWithDefaults({ onboardingCompletedVersion: 1 as never }).onboardingCompletedVersion)
      .toBe('')
    expect(
      mergeWithDefaults({ onboardingCompletedVersion: 'x'.repeat(40) }).onboardingCompletedVersion,
    ).toBe('')
  })

  it('validateConfig acepta el default y un valor corto', () => {
    expect(validateConfig(mergeWithDefaults({}))).toEqual([])
    expect(validateConfig(mergeWithDefaults({ onboardingCompletedVersion: '1' }))).toEqual([])
  })
})

describe('orchestratorPath', () => {
  it('default es string vacío', () => {
    expect(CONFIG_DEFAULTS.orchestratorPath).toBe('')
    expect(mergeWithDefaults({}).orchestratorPath).toBe('')
  })

  it('merge conserva business y engineer', () => {
    expect(mergeWithDefaults({ orchestratorPath: 'business' }).orchestratorPath).toBe('business')
    expect(mergeWithDefaults({ orchestratorPath: 'engineer' }).orchestratorPath).toBe('engineer')
  })

  it('merge convierte basura a vacío', () => {
    expect(mergeWithDefaults({ orchestratorPath: 'admin' as never }).orchestratorPath).toBe('')
    expect(mergeWithDefaults({ orchestratorPath: 1 as never }).orchestratorPath).toBe('')
    expect(sanitizeOrchestratorPath(null)).toBe('')
    expect(sanitizeOrchestratorPath(undefined)).toBe('')
  })

  it('config vieja sin la clave sigue válida tras el merge', () => {
    const merged = mergeWithDefaults({ onboardingCompletedVersion: '1' })
    expect(merged.orchestratorPath).toBe('')
    expect(validateConfig(merged)).toEqual([])
  })
})

describe('onboardingSentFirstMessage / onboardingAssignedContext / onboardingGuideDone', () => {
  it('defaults son false, false y []', () => {
    expect(CONFIG_DEFAULTS.onboardingSentFirstMessage).toBe(false)
    expect(CONFIG_DEFAULTS.onboardingAssignedContext).toBe(false)
    expect(CONFIG_DEFAULTS.onboardingGuideDone).toEqual([])
    expect(mergeWithDefaults({}).onboardingSentFirstMessage).toBe(false)
    expect(mergeWithDefaults({}).onboardingAssignedContext).toBe(false)
    expect(mergeWithDefaults({}).onboardingGuideDone).toEqual([])
  })

  it('merge conserva valores válidos', () => {
    const merged = mergeWithDefaults({
      onboardingSentFirstMessage: true,
      onboardingAssignedContext: true,
      onboardingGuideDone: ['path', 'folder'],
    })
    expect(merged.onboardingSentFirstMessage).toBe(true)
    expect(merged.onboardingAssignedContext).toBe(true)
    expect(merged.onboardingGuideDone).toEqual(['path', 'folder'])
    expect(mergeWithDefaults({ onboardingSentFirstMessage: false }).onboardingSentFirstMessage)
      .toBe(false)
  })

  it('basura (números, null, string en vez de array) cae al default', () => {
    expect(mergeWithDefaults({ onboardingSentFirstMessage: 1 as never }).onboardingSentFirstMessage)
      .toBe(false)
    expect(mergeWithDefaults({ onboardingSentFirstMessage: null as never }).onboardingSentFirstMessage)
      .toBe(false)
    expect(mergeWithDefaults({ onboardingAssignedContext: 1 as never }).onboardingAssignedContext)
      .toBe(false)
    expect(mergeWithDefaults({ onboardingAssignedContext: null as never }).onboardingAssignedContext)
      .toBe(false)
    expect(mergeWithDefaults({ onboardingGuideDone: 1 as never }).onboardingGuideDone).toEqual([])
    expect(mergeWithDefaults({ onboardingGuideDone: null as never }).onboardingGuideDone).toEqual([])
    expect(mergeWithDefaults({ onboardingGuideDone: 'path' as never }).onboardingGuideDone).toEqual([])
  })

  it('config vieja sin las claves sigue válida tras el merge', () => {
    const merged = mergeWithDefaults({ onboardingCompletedVersion: '1' })
    expect(merged.onboardingSentFirstMessage).toBe(false)
    expect(merged.onboardingAssignedContext).toBe(false)
    expect(merged.onboardingGuideDone).toEqual([])
    expect(validateConfig(merged)).toEqual([])
  })

  it('validateConfig acepta el merge y rechaza un boolean falso y una lista sucia', () => {
    expect(validateConfig(mergeWithDefaults({
      onboardingSentFirstMessage: true,
      onboardingAssignedContext: true,
      onboardingGuideDone: ['path'],
    }))).toEqual([])

    const badBool = {
      ...CONFIG_DEFAULTS,
      onboardingSentFirstMessage: 'yes' as unknown as boolean,
    }
    expect(validateConfig(badBool)).toContain('onboardingSentFirstMessage debe ser un boolean')

    const dirtyList = {
      ...CONFIG_DEFAULTS,
      onboardingGuideDone: ['  path  ', 'path'],
    }
    expect(validateConfig(dirtyList)).toContain('onboardingGuideDone inválido')
  })
})

describe('sanitizeOnboardingGuideDone', () => {
  it('trim y vacías fuera', () => {
    expect(sanitizeOnboardingGuideDone(['  path  ', '', '  ', 'folder'])).toEqual(['path', 'folder'])
  })

  it('dedupe conservando el orden', () => {
    expect(sanitizeOnboardingGuideDone(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('tope 32 entradas', () => {
    const input = Array.from({ length: 40 }, (_, i) => `step-${i}`)
    const out = sanitizeOnboardingGuideDone(input)
    expect(out).toHaveLength(32)
    expect(out[0]).toBe('step-0')
    expect(out[31]).toBe('step-31')
  })

  it('corta las de más de 64 chars', () => {
    expect(sanitizeOnboardingGuideDone(['ok', 'x'.repeat(65), 'also'])).toEqual(['ok', 'also'])
  })
})
