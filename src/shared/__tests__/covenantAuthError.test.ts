import { describe, expect, it } from 'vitest'
import { describeCovenantSignInError } from '../covenantAuthError'

const SOURCES = ['settings', 'env', 'keychain', 'none'] as const

const LABEL: Record<(typeof SOURCES)[number], string> = {
  settings: 'Ajustes > GitHub',
  env: 'la variable GITHUB_TOKEN',
  keychain: 'el keychain de git (git credential)',
  none: 'origen desconocido',
}

describe('describeCovenantSignInError', () => {
  it.each(SOURCES)('no-github-token sale intacto (%s)', source => {
    expect(describeCovenantSignInError('no-github-token', source)).toBe('no-github-token')
  })

  it.each(SOURCES)('unauthorized / bad credentials / 401 con origen %s', source => {
    const expected = `GitHub rechazó el token que la app tomó de ${LABEL[source]}: está vencido, revocado o no puede leer tu cuenta. Genera uno nuevo en github.com/settings/tokens y pégalo en Ajustes > GitHub.`
    expect(describeCovenantSignInError('unauthorized', source)).toBe(expected)
    expect(describeCovenantSignInError('Unauthorized', source)).toBe(expected)
    expect(describeCovenantSignInError('Bad credentials', source)).toBe(expected)
    expect(describeCovenantSignInError('401', source)).toBe(expected)
  })

  it.each(SOURCES)('5xx de Covenant con origen %s', source => {
    const five = 'Covenant respondió con 500 Internal Server Error'
    expect(describeCovenantSignInError(five, source)).toBe(
      `El servidor de Covenant no respondió (${five}). Reintenta en un momento.`,
    )
    expect(describeCovenantSignInError('proxy 502 bad gateway', source)).toBe(
      'El servidor de Covenant no respondió (proxy 502 bad gateway). Reintenta en un momento.',
    )
    expect(describeCovenantSignInError('503', source)).toBe(
      'El servidor de Covenant no respondió (503). Reintenta en un momento.',
    )
    expect(describeCovenantSignInError('gateway 504', source)).toBe(
      'El servidor de Covenant no respondió (gateway 504). Reintenta en un momento.',
    )
  })

  it.each(SOURCES)('resto anota el origen %s', source => {
    expect(describeCovenantSignInError('timeout', source)).toBe(
      `timeout (token tomado de ${LABEL[source]})`,
    )
  })
})
