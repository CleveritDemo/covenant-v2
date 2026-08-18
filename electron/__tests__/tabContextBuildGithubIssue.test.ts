import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverTabContexts, materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'

const context: TabContext = {
  id: 'iaterminal:githubissue:acme-app-12',
  name: 'acme/app#12',
  fileName: 'github/acme-app-12.md',
  kind: 'githubIssue',
  issueNumber: 12,
  repoFullName: 'acme/app',
}

function projectWithIssue(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ctx-'))
  mkdirSync(join(dir, '.gravity', 'github'), { recursive: true })
  writeFileSync(join(dir, '.gravity', 'github', 'acme-app-12.md'), body, 'utf8')
  return dir
}

describe('materializeTabContext con kind githubIssue', () => {
  it('lee el archivo del disco tal cual: no llama a nadie', () => {
    const dir = projectWithIssue('<!-- iaterminal:auto -->\n## Resumen\n#12\n<!-- /iaterminal:auto -->')
    const result = materializeTabContext(context, dir)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
    expect(result.filePath).toBe(join(dir, '.gravity', 'github', 'acme-app-12.md'))
  })

  it('sin snapshot todavía y sin write: ok false, no excepción', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ctx-'))
    expect(materializeTabContext(context, dir).ok).toBe(false)
  })

  it('write:true sin snapshot escribe metadata aunque la región auto esté vacía', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ctx-'))
    const result = materializeTabContext(context, dir, { write: true })
    expect(result.ok).toBe(true)
    const body = readFileSync(join(dir, '.gravity', 'github', 'acme-app-12.md'), 'utf8')
    expect(body).toContain('"kind":"githubIssue"')
    expect(body).toContain('"issueNumber":12')
    expect(body).toContain('acme/app')
    expect(body).toContain('<!-- iaterminal:auto -->')
  })

  it('discover lista github/*.md', () => {
    const dir = projectWithIssue([
      '<!-- iaterminal:context {"version":1,"id":"iaterminal:githubissue:acme-app-12","name":"acme/app#12","fileName":"github/acme-app-12.md","kind":"githubIssue","issueNumber":12,"repoFullName":"acme/app"} -->',
      '',
      '<!-- iaterminal:auto -->',
      '## Resumen',
      '#12',
      '<!-- /iaterminal:auto -->',
    ].join('\n'))
    const discovered = discoverTabContexts(dir)
    const found = discovered.contexts.find(item => item.kind === 'githubIssue')
    expect(found?.fileName).toBe('github/acme-app-12.md')
    expect(found?.issueNumber).toBe(12)
    expect(found?.repoFullName).toBe('acme/app')
  })
})
