import { describe, expect, it } from 'vitest'
import { parseJiraConfig } from '../jiraConfig'

describe('parseJiraConfig', () => {
  it('rellena los defaults documentados', () => {
    expect(parseJiraConfig({ site: 'https://x.atlassian.net' })).toEqual({
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'assignee = currentUser() AND sprint in openSprints()',
      refreshSeconds: 900,
      maxComments: 10,
    })
  })

  it('normaliza el sitio: sin barra final y en minúsculas', () => {
    expect(parseJiraConfig({ site: 'HTTPS://X.Atlassian.net/' })?.site)
      .toBe('https://x.atlassian.net')
  })

  it('las claves de proyecto se normalizan a mayúsculas y se deduplican', () => {
    expect(parseJiraConfig({ site: 'https://x.atlassian.net', projectKeys: ['grav', 'GRAV', 'cov'] })?.projectKeys)
      .toEqual(['GRAV', 'COV'])
  })

  it('sin site no hay config: null', () => {
    expect(parseJiraConfig({ projectKeys: ['GRAV'] })).toBeNull()
    expect(parseJiraConfig({ site: 'no-es-una-url' })).toBeNull()
    expect(parseJiraConfig(null)).toBeNull()
  })

  it('un site que no es https se rechaza: el token viaja en la cabecera', () => {
    expect(parseJiraConfig({ site: 'http://x.atlassian.net' })).toBeNull()
  })

  it('nunca expone un campo de credencial aunque el archivo lo traiga', () => {
    const parsed = parseJiraConfig({ site: 'https://x.atlassian.net', apiToken: 'secreto' })
    expect(JSON.stringify(parsed)).not.toContain('secreto')
  })

  it('valores fuera de rango vuelven al default', () => {
    const parsed = parseJiraConfig({ site: 'https://x.atlassian.net', refreshSeconds: -5, maxComments: 999 })
    expect(parsed?.refreshSeconds).toBe(900)
    expect(parsed?.maxComments).toBe(50)
  })
})
