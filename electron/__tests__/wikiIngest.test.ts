import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyWikiIngestFromFinalText } from '../wikiIngest'
import { wikiRootPath } from '../wikiStore'
import type { TabContext } from '../../src/shared/tabContext'

const wikiContext: TabContext = {
  id: 'iaterminal:wiki',
  name: 'Wiki',
  fileName: 'wiki.md',
  kind: 'wiki',
}
const notesContext: TabContext = {
  id: 'iaterminal:notes:Plan',
  name: 'Plan',
  fileName: 'Plan.md',
  kind: 'notes',
}

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'wiki-ingest-'))
  roots.push(root)
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true })
})

function fenced(json: string): string {
  return `Listo el turno.\n\n\`\`\`ia-terminal-wiki\n${json}\n\`\`\`\n`
}

describe('applyWikiIngestFromFinalText', () => {
  it('con wiki asignada aplica las ops y limpia el fence del texto visible', () => {
    const cwd = makeRoot()
    const result = applyWikiIngestFromFinalText(
      fenced('{"ops":[{"op":"upsert","slug":"auth-flow","title":"Auth flow","type":"decision","body":"Cómo entra el usuario."}],"log":"alta de auth-flow"}'),
      [notesContext, wikiContext],
      cwd,
      { agentId: 'frontend' },
    )
    expect(result.visibleText).toBe('Listo el turno.')
    expect(result).toMatchObject({ applied: 1, errors: [], persisted: true })

    const root = wikiRootPath(cwd)
    expect(readFileSync(join(root, 'pages', 'auth-flow.md'), 'utf8')).toContain('Cómo entra el usuario.')
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toContain('[[auth-flow]]')
    expect(readFileSync(join(root, 'log.md'), 'utf8'))
      .toMatch(/- `\d{4}-\d{2}-\d{2}T[^`]+` — \[frontend\] alta de auth-flow\n$/)
  })

  it('sin wiki asignada remueve el fence pero no escribe nada', () => {
    const cwd = makeRoot()
    const result = applyWikiIngestFromFinalText(
      fenced('{"ops":[{"op":"upsert","slug":"a","title":"A","type":"concept","body":"x"}],"log":"alta"}'),
      [notesContext],
      cwd,
    )
    expect(result.visibleText).toBe('Listo el turno.')
    expect(result).toMatchObject({ applied: 0, errors: [], persisted: false })
    expect(existsSync(wikiRootPath(cwd))).toBe(false)
  })

  it('sin fence devuelve el texto tal cual y no toca disco', () => {
    const cwd = makeRoot()
    const result = applyWikiIngestFromFinalText('Solo prosa.', [wikiContext], cwd)
    expect(result.visibleText).toBe('Solo prosa.')
    expect(result.persisted).toBe(false)
    expect(existsSync(wikiRootPath(cwd))).toBe(false)
  })

  it('sin línea log autogenera el summary desde las ops', () => {
    const cwd = makeRoot()
    applyWikiIngestFromFinalText(
      fenced('{"ops":[{"op":"upsert","slug":"a","title":"A","type":"concept","body":"x"},{"op":"upsert","slug":"b","title":"B","type":"concept","body":"y"},{"op":"delete","slug":"c"}]}'),
      [wikiContext],
      cwd,
      { agentId: 'frontend' },
    )
    const log = readFileSync(join(wikiRootPath(cwd), 'log.md'), 'utf8')
    expect(log).toMatch(/- `[^`]+` — \[frontend\] upsert a, b; delete c\n$/)
  })

  it('respeta los caps: máximo 8 ops por turno y title recortado a 120', () => {
    const cwd = makeRoot()
    const ops = Array.from({ length: 9 }, (_, index) => (
      `{"op":"upsert","slug":"p-${index}","title":"${'T'.repeat(200)}","type":"concept","body":"x"}`
    ))
    const result = applyWikiIngestFromFinalText(
      fenced(`{"ops":[${ops.join(',')}]}`),
      [wikiContext],
      cwd,
    )
    expect(result.applied).toBe(8)
    expect(existsSync(join(wikiRootPath(cwd), 'pages', 'p-8.md'))).toBe(false)
    const firstLine = readFileSync(join(wikiRootPath(cwd), 'pages', 'p-0.md'), 'utf8').split('\n')[0]
    expect(firstLine).toBe(`# ${'T'.repeat(120)}`)
  })

  it('con contexts vacíos (flag ya persistido) limpia el fence sin re-aplicar', () => {
    const cwd = makeRoot()
    const text = fenced('{"ops":[{"op":"upsert","slug":"a","title":"A","type":"concept","body":"x"}],"log":"alta"}')
    const first = applyWikiIngestFromFinalText(text, [wikiContext], cwd, { agentId: 'tl' })
    expect(first.persisted).toBe(true)
    const logAfterFirst = readFileSync(join(wikiRootPath(cwd), 'log.md'), 'utf8')

    const second = applyWikiIngestFromFinalText(text, [], cwd, { agentId: 'tl' })
    expect(second.visibleText).toBe('Listo el turno.')
    expect(second.persisted).toBe(false)
    expect(readFileSync(join(wikiRootPath(cwd), 'log.md'), 'utf8')).toBe(logAfterFirst)
  })
})
