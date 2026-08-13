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
  it('un prefijo de clave lista el proyecto por actividad, no lo busca por texto', () => {
    // El `~` de Jira no indexa la clave de la issue: `text ~ "CT-*"` no casa
    // NUNCA con CT-128. Con un prefijo de clave lo útil es el proyecto entero
    // ordenado por actividad, y el recorte por dígitos se hace después.
    expect(buildJiraQuickJql('CT-', config())).toBe('project = CT ORDER BY updated DESC')
    expect(buildJiraQuickJql('ct-12', config())).toBe('project = CT ORDER BY updated DESC')
  })

  it('el prefijo tecleado manda sobre projectKeys: sirve aunque Ajustes esté mal', () => {
    // El prefijo ES la clave del proyecto. Si se acotara con `projectKeys` mal
    // puestos (el nombre del proyecto en vez de la clave), esto no devolvería
    // nada — que es exactamente el estado en el que se descubrió.
    expect(buildJiraQuickJql('CT-128', config({ projectKeys: ['CDLC-TRANSFORMATION'] })))
      .toBe('project = CT ORDER BY updated DESC')
  })

  it('nunca usa `key =`: sobre una issue inexistente Jira rechaza el JQL entero', () => {
    expect(buildJiraQuickJql('grav-412', config())).not.toContain('key =')
  })

  it('texto libre queda acotado a los proyectos declarados', () => {
    expect(buildJiraQuickJql('login roto', config())).toBe(
      'project in (GRAV) AND (summary ~ "login roto*" OR text ~ "login roto*") ORDER BY updated DESC',
    )
  })

  it('sin proyectos declarados, el texto libre no lleva scope', () => {
    expect(buildJiraQuickJql('login roto', config({ projectKeys: [] }))).toBe(
      '(summary ~ "login roto*" OR text ~ "login roto*") ORDER BY updated DESC',
    )
  })

  it('varios proyectos declarados se unen con coma', () => {
    expect(buildJiraQuickJql('x', config({ projectKeys: ['GRAV', 'OPS'] }))).toBe(
      'project in (GRAV, OPS) AND (summary ~ "x*" OR text ~ "x*") ORDER BY updated DESC',
    )
  })

  it('comillas y backslashes del usuario se eliminan: no pueden romper el JQL', () => {
    expect(buildJiraQuickJql('dice "hola\\adios"', config({ projectKeys: [] }))).toBe(
      '(summary ~ "dice  hola adios*" OR text ~ "dice  hola adios*") ORDER BY updated DESC',
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
