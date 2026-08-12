import { describe, expect, it } from 'vitest'
import type { JiraIssueSnapshot } from '../jiraIssue'
import { adfToText, issueAutoMarkdown, withJiraAutoBlock } from '../jiraIssueDoc'

const issue: JiraIssueSnapshot = {
  key: 'GRAV-412',
  summary: 'Loop chain se queda colgada si el agente B muere',
  status: 'In Progress',
  issueType: 'Bug',
  assignee: 'Rodrigo',
  priority: 'High',
  sprint: 'Sprint 34',
  updated: '2026-08-12T09:40:00.000Z',
  url: 'https://x.atlassian.net/browse/GRAV-412',
  description: 'El FIFO no libera el slot.',
  acceptanceCriteria: 'La cadena avanza aunque B muera.',
  comments: [
    { author: 'Ana', created: '2026-08-11T10:00:00.000Z', body: 'reproducido' },
    { author: 'Luis', created: '2026-08-11T11:00:00.000Z', body: 'mira loopChainFifo' },
    { author: 'Ana', created: '2026-08-11T12:00:00.000Z', body: 'confirmado' },
  ],
  subtasks: [
    { key: 'GRAV-413', summary: 'test de regresión', status: 'To Do', issueType: 'Sub-task', assignee: null },
  ],
  links: [{ type: 'blocks', key: 'GRAV-400', summary: 'Refactor del orquestador' }],
}

describe('adfToText', () => {
  it('aplana párrafos y texto', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] },
      ],
    }
    expect(adfToText(adf)).toBe('Hola mundo\n\nSegundo')
  })

  it('los ítems de lista salen como viñetas', () => {
    const adf = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }] },
        ],
      }],
    }
    expect(adfToText(adf)).toBe('- uno\n- dos')
  })

  it('una cadena plana (API v2 o campo ya renderizado) pasa tal cual', () => {
    expect(adfToText('texto plano')).toBe('texto plano')
  })

  it('null o basura devuelve cadena vacía, no una excepción', () => {
    expect(adfToText(null)).toBe('')
    expect(adfToText(42)).toBe('')
  })
})

describe('issueAutoMarkdown', () => {
  it('la cabecera lleva clave, título, estado y fecha de actualización', () => {
    const md = issueAutoMarkdown(issue, 10)
    expect(md).toContain('## Resumen')
    expect(md).toContain('GRAV-412 · Loop chain se queda colgada si el agente B muere')
    expect(md).toContain('Estado: In Progress · Tipo: Bug · Prioridad: High')
    expect(md).toContain('Actualizada: 2026-08-12T09:40:00.000Z')
  })

  it('cada bloque es una sección `##`: son las claves que pide el modelo', () => {
    const headings = issueAutoMarkdown(issue, 10).match(/^## .+$/gm)
    expect(headings).toEqual([
      '## Resumen',
      '## Descripción',
      '## Criterios de aceptación',
      '## Comentarios',
      '## Enlaces y subtareas',
    ])
  })

  it('maxComments recorta por los más recientes', () => {
    const md = issueAutoMarkdown(issue, 2)
    expect(md).toContain('Luis')
    expect(md).toContain('confirmado')
    expect(md).not.toContain('reproducido')
  })

  it('sin criterios de aceptación no se escribe la sección vacía', () => {
    const md = issueAutoMarkdown({ ...issue, acceptanceCriteria: null }, 10)
    expect(md).not.toContain('## Criterios de aceptación')
  })
})

describe('withJiraAutoBlock', () => {
  const meta = '<!-- iaterminal:context {"id":"iaterminal:jira:grav-412","kind":"jira"} -->'

  it('sobre un archivo inexistente crea el documento completo con notes vacías', () => {
    const doc = withJiraAutoBlock('', meta, '## Resumen\nGRAV-412')
    expect(doc).toContain(meta)
    expect(doc).toContain('<!-- iaterminal:auto -->')
    expect(doc).toContain('<!-- /iaterminal:auto -->')
    expect(doc).toContain('<!-- iaterminal:notes -->')
  })

  it('AL REFRESCAR, las notas sobreviven intactas', () => {
    const first = withJiraAutoBlock('', meta, '## Resumen\nviejo')
    const annotated = first.replace(
      '<!-- iaterminal:notes -->\n',
      '<!-- iaterminal:notes -->\nla carrera está en loopChainFifo\n',
    )
    const refreshed = withJiraAutoBlock(annotated, meta, '## Resumen\nnuevo')
    expect(refreshed).toContain('la carrera está en loopChainFifo')
    expect(refreshed).toContain('nuevo')
    expect(refreshed).not.toContain('viejo')
  })

  it('no duplica la región auto al refrescar dos veces', () => {
    let doc = withJiraAutoBlock('', meta, '## Resumen\nuno')
    doc = withJiraAutoBlock(doc, meta, '## Resumen\ndos')
    doc = withJiraAutoBlock(doc, meta, '## Resumen\ntres')
    expect(doc.match(/<!-- iaterminal:auto -->/g)).toHaveLength(1)
    expect(doc.match(/<!-- iaterminal:notes -->/g)).toHaveLength(1)
  })
})
