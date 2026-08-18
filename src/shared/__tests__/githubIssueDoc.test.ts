import { describe, expect, it } from 'vitest'
import type { GithubIssueSnapshot } from '../githubIssue'
import { AUTO_END, AUTO_START } from '../contextSections'
import {
  GITHUB_AUTO_RE,
  githubIssueAutoMarkdown,
  githubSnapshotHasContent,
  parseGithubIssuePreview,
  parseGithubResumenBlock,
  withGithubAutoBlock,
} from '../githubIssueDoc'

const issue: GithubIssueSnapshot = {
  number: 86,
  title: 'Loop chain se queda colgada si el agente B muere',
  state: 'open',
  repoFullName: 'CleveritDemo/covenant-v2',
  updated: '2026-08-12T09:40:00.000Z',
  author: 'karluiz',
  labels: ['bug', 'orchestrator'],
  url: 'https://github.com/CleveritDemo/covenant-v2/issues/86',
  body: 'El FIFO no libera el slot.',
  assignees: ['ana'],
  milestone: 'v0.87',
  comments: [
    { author: 'Ana', created: '2026-08-11T10:00:00.000Z', body: 'reproducido' },
    { author: 'Luis', created: '2026-08-11T11:00:00.000Z', body: 'mira loopChainFifo' },
    { author: 'Ana', created: '2026-08-11T12:00:00.000Z', body: 'confirmado' },
  ],
}

describe('githubIssueAutoMarkdown', () => {
  it('la cabecera lleva repo#número, título, estado y fecha', () => {
    const md = githubIssueAutoMarkdown(issue, 10)
    expect(md).toContain('## Resumen')
    expect(md).toContain('CleveritDemo/covenant-v2#86 · Loop chain se queda colgada si el agente B muere')
    expect(md).toContain('Estado: open · Autor: karluiz')
    expect(md).toContain('Actualizada: 2026-08-12T09:40:00.000Z')
  })

  it('cada bloque es una sección `##`', () => {
    const headings = githubIssueAutoMarkdown(issue, 10).match(/^## .+$/gm)
    expect(headings).toEqual([
      '## Resumen',
      '## Descripción',
      '## Comentarios',
      '## Enlaces',
    ])
  })

  it('maxComments recorta por los más recientes', () => {
    const md = githubIssueAutoMarkdown(issue, 2)
    expect(md).toContain('Luis')
    expect(md).toContain('confirmado')
    expect(md).not.toContain('reproducido')
  })

  it('maxComments 0 es CERO comentarios, no «todos»', () => {
    const md = githubIssueAutoMarkdown(issue, 0)
    expect(md).not.toContain('## Comentarios')
    expect(md).not.toContain('reproducido')
  })
})

describe('withGithubAutoBlock', () => {
  const meta = '<!-- iaterminal:context {"id":"iaterminal:githubissue:cleveritdemo-covenant-v2-86","kind":"githubIssue"} -->'

  it('sobre un archivo inexistente crea el documento completo con notes vacías', () => {
    const doc = withGithubAutoBlock('', meta, '## Resumen\n#86')
    expect(doc).toContain(meta)
    expect(doc).toContain('<!-- iaterminal:auto -->')
    expect(doc).toContain('<!-- /iaterminal:auto -->')
    expect(doc).toContain('<!-- iaterminal:notes -->')
  })

  it('AL REFRESCAR, las notas sobreviven intactas', () => {
    const first = withGithubAutoBlock('', meta, '## Resumen\nviejo')
    const annotated = first.replace(
      '<!-- iaterminal:notes -->\n',
      '<!-- iaterminal:notes -->\nla carrera está en loopChainFifo\n',
    )
    const refreshed = withGithubAutoBlock(annotated, meta, '## Resumen\nnuevo')
    expect(refreshed).toContain('la carrera está en loopChainFifo')
    expect(refreshed).toContain('nuevo')
    expect(refreshed).not.toContain('viejo')
  })

  it('GITHUB_AUTO_RE se deriva de los marcadores importados', () => {
    const asSource = (literal: string): string =>
      new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).source
    expect(GITHUB_AUTO_RE.source).toContain(asSource(AUTO_START))
    expect(GITHUB_AUTO_RE.source).toContain(asSource(AUTO_END))
  })
})

describe('parseGithubResumenBlock', () => {
  it('extrae resumen, estado y fecha del bloque que escribe githubIssueAutoMarkdown', () => {
    const auto = githubIssueAutoMarkdown(issue, 10)
    expect(parseGithubResumenBlock(auto)).toEqual({
      summary: issue.title,
      status: issue.state,
      updated: issue.updated,
    })
  })

  it('sin bloque "## Resumen", null', () => {
    expect(parseGithubResumenBlock('## Descripción\nsin resumen aquí')).toBeNull()
  })
})

describe('parseGithubIssuePreview', () => {
  const meta = '<!-- iaterminal:context {"id":"iaterminal:githubissue:cleveritdemo-covenant-v2-86","kind":"githubIssue"} -->'

  it('con snapshot real, no está vencido y trae resumen/estado/actualización', () => {
    const doc = withGithubAutoBlock('', meta, githubIssueAutoMarkdown(issue, 10))
    expect(parseGithubIssuePreview(doc)).toEqual({
      stale: false,
      summary: issue.title,
      status: issue.state,
      updated: issue.updated,
    })
  })

  it('región auto vacía: vencido, sin resumen', () => {
    expect(parseGithubIssuePreview(withGithubAutoBlock('', meta, ''))).toEqual({ stale: true })
  })
})

describe('githubSnapshotHasContent', () => {
  const meta = '<!-- iaterminal:context {"id":"iaterminal:githubissue:cleveritdemo-covenant-v2-86","kind":"githubIssue"} -->'

  it('el placeholder del alta NO cuenta como contenido', () => {
    expect(githubSnapshotHasContent(withGithubAutoBlock('', meta, ''))).toBe(false)
  })

  it('una región auto con markdown real sí', () => {
    expect(githubSnapshotHasContent(withGithubAutoBlock('', meta, githubIssueAutoMarkdown(issue, 10)))).toBe(true)
  })
})
