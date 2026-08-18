import { describe, expect, it } from 'vitest'
import { githubRowFromIssue, jiraRowFromIssue, selectIssueMentionSources } from '../issueMention'
import type { JiraIssueRef } from '../jiraIssue'

const issue: JiraIssueRef = {
  key: 'GRAV-412',
  summary: 'Loop chain colgada',
  status: 'In Progress',
  issueType: 'Bug',
  assignee: 'Rodrigo',
  updated: '2026-08-12T09:40:00.000Z',
}

describe('jiraRowFromIssue', () => {
  it('la etiqueta es la clave y el título el resumen', () => {
    const row = jiraRowFromIssue(issue)
    expect(row.source).toBe('jira')
    expect(row.id).toBe('GRAV-412')
    expect(row.label).toBe('GRAV-412')
    expect(row.title).toBe('Loop chain colgada')
    expect(row.updated).toBe(issue.updated)
  })

  it('meta nombra Jira, el tipo, la clave del proyecto y el estado', () => {
    expect(jiraRowFromIssue(issue).meta).toEqual(['Jira', 'Bug', 'GRAV', 'In Progress'])
  })

  it('meta omite huecos: tipo o estado vacíos no dejan un punto suelto', () => {
    expect(jiraRowFromIssue({
      ...issue,
      issueType: '',
      status: '',
    }).meta).toEqual(['Jira', 'GRAV'])
  })
})

describe('githubRowFromIssue', () => {
  it('la etiqueta es #número y meta nombra GitHub, el repo y el estado', () => {
    expect(githubRowFromIssue({
      number: 86,
      title: 'Fix picker',
      state: 'open',
      repoFullName: 'CleveritDemo/covenant-v2',
      updated: '2026-08-18T00:00:00.000Z',
    })).toEqual({
      source: 'github',
      id: 'CleveritDemo/covenant-v2#86',
      label: '#86',
      title: 'Fix picker',
      meta: ['GitHub', 'CleveritDemo/covenant-v2', 'open'],
      updated: '2026-08-18T00:00:00.000Z',
    })
  })
})

describe('selectIssueMentionSources', () => {
  const both = { jira: true, github: true }

  it('`#123` (solo dígitos) dispara solo GitHub', () => {
    expect(selectIssueMentionSources('123', both)).toEqual(['github'])
  })

  it('`#CT-1` / `CT-` disparan solo Jira', () => {
    expect(selectIssueMentionSources('CT-1', both)).toEqual(['jira'])
    expect(selectIssueMentionSources('CT-', both)).toEqual(['jira'])
  })

  it('texto libre dispara las dos; una desconectada no entra', () => {
    expect(selectIssueMentionSources('login', both)).toEqual(['jira', 'github'])
    expect(selectIssueMentionSources('login', { jira: false, github: true })).toEqual(['github'])
    expect(selectIssueMentionSources('123', { jira: true, github: false })).toEqual([])
  })
})
