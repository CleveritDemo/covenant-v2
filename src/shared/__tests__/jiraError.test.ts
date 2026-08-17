import { describe, expect, it } from 'vitest'
import { describeJiraFailure } from '../jiraError'

describe('describeJiraFailure', () => {
  it('401 guía a regenerar el API token', () => {
    expect(describeJiraFailure(401, '', {})).toBe(
      'Jira 401 · credencial rechazada. Revisa el email de la cuenta y genera un API token nuevo en id.atlassian.com.',
    )
  })

  it('403 sin cabeceras explica credencial aceptada y acceso denegado', () => {
    expect(describeJiraFailure(403, '', {})).toBe(
      'Jira 403 · la credencial se aceptó pero el acceso está denegado. Causas típicas: el API token tiene scopes y no cubre este endpoint, la cuenta no tiene acceso al producto Jira en este sitio, o el sitio tiene allowlist de IP.',
    )
  })

  it('403 con x-authentication-denied-reason añade el motivo de Atlassian', () => {
    expect(
      describeJiraFailure(403, '', { 'x-authentication-denied-reason': 'CAPTCHA_CHALLENGE' }),
    ).toBe(
      'Jira 403 · la credencial se aceptó pero el acceso está denegado. Causas típicas: el API token tiene scopes y no cubre este endpoint, la cuenta no tiene acceso al producto Jira en este sitio, o el sitio tiene allowlist de IP. Motivo de Atlassian: CAPTCHA_CHALLENGE.',
    )
  })

  it('429 con retry-after indica cuántos segundos esperar', () => {
    expect(describeJiraFailure(429, '', { 'retry-after': '12' })).toBe(
      'Jira 429 · demasiadas peticiones. Reintenta en 12 s.',
    )
  })

  it('500 (y el resto de 5xx) dice que falló el sitio de Atlassian', () => {
    expect(describeJiraFailure(500, '', {})).toBe('Jira 500 · el sitio de Atlassian falló.')
    expect(describeJiraFailure(503, '', {})).toBe('Jira 503 · el sitio de Atlassian falló.')
  })

  it('un status raro solo lleva Jira <status>', () => {
    expect(describeJiraFailure(418, '', {})).toBe('Jira 418')
  })

  it('el detail no vacío se anexa al final', () => {
    expect(describeJiraFailure(404, 'Issue does not exist', {})).toBe(
      'Jira 404 · el sitio o la issue no existe, o no es visible para esta cuenta. Detalle: Issue does not exist',
    )
  })
})
