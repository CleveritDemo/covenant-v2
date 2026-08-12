import { describe, expect, it } from 'vitest'
import type { JiraProjectConfig } from '../jiraConfig'
import { buildJiraQuickJql } from '../jiraQuickJql'

function config(overrides: Partial<JiraProjectConfig> = {}): JiraProjectConfig {
  return {
    site: 'https://x.atlassian.net',
    projectKeys: ['GRAV'],
    defaultJql: 'assignee = currentUser() AND sprint in openSprints()',
    refreshSeconds: 900,
    maxComments: 10,
    ...overrides,
  }
}

describe('buildJiraQuickJql', () => {
  it('una clave exacta busca esa issue, ignorando el resto del texto', () => {
    expect(buildJiraQuickJql('grav-412', config())).toBe('key = GRAV-412')
  })

  it('una clave de otro proyecto igual se trata como clave: no hay filtro por proyecto', () => {
    expect(buildJiraQuickJql('OTHER-9', config())).toBe('key = OTHER-9')
  })

  it('texto libre queda acotado a los proyectos declarados', () => {
    expect(buildJiraQuickJql('login roto', config())).toBe(
      'project in (GRAV) AND summary ~ "login roto*" ORDER BY updated DESC',
    )
  })

  it('sin proyectos declarados, el texto libre no lleva scope', () => {
    expect(buildJiraQuickJql('login roto', config({ projectKeys: [] }))).toBe(
      'summary ~ "login roto*" ORDER BY updated DESC',
    )
  })

  it('varios proyectos declarados se unen con coma', () => {
    expect(buildJiraQuickJql('x', config({ projectKeys: ['GRAV', 'OPS'] }))).toBe(
      'project in (GRAV, OPS) AND summary ~ "x*" ORDER BY updated DESC',
    )
  })

  it('comillas y backslashes del usuario se eliminan: no pueden romper el JQL', () => {
    expect(buildJiraQuickJql('dice "hola\\adios"', config({ projectKeys: [] }))).toBe(
      'summary ~ "dice  hola adios*" ORDER BY updated DESC',
    )
  })

  it('query vacía con proyectos declarados cae al defaultJql, acotado', () => {
    expect(buildJiraQuickJql('', config())).toBe(
      'project in (GRAV) AND assignee = currentUser() AND sprint in openSprints()',
    )
  })

  it('query vacía sin proyectos declarados cae al defaultJql tal cual', () => {
    expect(buildJiraQuickJql('   ', config({ projectKeys: [] }))).toBe(
      'assignee = currentUser() AND sprint in openSprints()',
    )
  })
})
