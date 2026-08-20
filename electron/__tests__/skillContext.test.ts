import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { listSkills, materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('skill context', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-skill-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const skillContext = (stem: string): TabContext => ({
    id: `iaterminal:skill:${stem}`,
    name: stem,
    fileName: `${stem}.md`,
    kind: 'skill',
  })

  it('materializar con content crea SKILL.md y la previa lo devuelve', () => {
    const cwd = tempCwd()
    const context = skillContext('mi-skill')
    const body = '## Cuándo\nUsar al migrar.'

    const preview = materializeTabContext(context, cwd, { content: body })
    expect(preview.ok).toBe(true)
    expect(preview.content).toContain('## Cuándo')
    expect(preview.notesContent).toBe(body)

    const skillPath = join(cwd, PROJECT_DIR, 'skills', 'mi-skill', 'SKILL.md')
    expect(existsSync(skillPath)).toBe(false)

    const saved = materializeTabContext(context, cwd, { write: true, content: body })
    expect(saved.ok).toBe(true)
    expect(readFileSync(skillPath, 'utf8')).toBe(body)
    expect(saved.content).toContain('## Cuándo')
    expect(saved.notesContent).toBe(body)
  })

  it('volver a materializar con otro content sobrescribe SKILL.md', () => {
    const cwd = tempCwd()
    const context = skillContext('overwrite')
    materializeTabContext(context, cwd, { write: true, content: 'primera' })
    materializeTabContext(context, cwd, { write: true, content: 'segunda' })
    const skillPath = join(cwd, PROJECT_DIR, 'skills', 'overwrite', 'SKILL.md')
    expect(readFileSync(skillPath, 'utf8')).toBe('segunda')
  })

  it('sin content la previa lee el archivo y notesContent devuelve el cuerpo', () => {
    const cwd = tempCwd()
    const skillPath = join(cwd, PROJECT_DIR, 'skills', 'desde-disco', 'SKILL.md')
    mkdirSync(join(cwd, PROJECT_DIR, 'skills', 'desde-disco'), { recursive: true })
    writeFileSync(skillPath, 'cuerpo en disco', 'utf8')

    const context = skillContext('desde-disco')
    const preview = materializeTabContext(context, cwd)
    expect(preview.ok).toBe(true)
    expect(preview.content).toContain('cuerpo en disco')
    expect(preview.notesContent).toBe('cuerpo en disco')
  })

  it('un skill sin archivo devuelve (empty) sin lanzar', () => {
    const cwd = tempCwd()
    const result = materializeTabContext(skillContext('ausente'), cwd)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('(empty)')
    expect(result.notesContent).toBe('')
  })

  it('la previa en vivo sigue al content sin escribir disco', () => {
    const cwd = tempCwd()
    const context = skillContext('live')
    const live = materializeTabContext(context, cwd, { content: '  borrador  ' })
    expect(live.content).toContain('borrador')
    expect(existsSync(join(cwd, PROJECT_DIR, 'skills', 'live', 'SKILL.md'))).toBe(false)
  })

  it('listSkills devuelve [] sin carpeta skills', () => {
    const cwd = tempCwd()
    expect(listSkills(cwd)).toEqual({ ok: true, skills: [] })
  })

  it('listSkills devuelve stem, name y description del frontmatter', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'skills', 'con-meta'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'skills', 'con-meta', 'SKILL.md'),
      ['---', 'name: Meta Skill', 'description: Hace cosas', '---', '', '## Cuerpo'].join('\n'),
      'utf8',
    )
    mkdirSync(join(cwd, PROJECT_DIR, 'skills', 'sin-meta'), { recursive: true })
    writeFileSync(join(cwd, PROJECT_DIR, 'skills', 'sin-meta', 'SKILL.md'), '## Solo', 'utf8')

    const result = listSkills(cwd)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skills).toHaveLength(2)
    expect(result.skills[0]).toMatchObject({
      stem: 'con-meta',
      name: 'Meta Skill',
      description: 'Hace cosas',
    })
    expect(result.skills[1]).toMatchObject({
      stem: 'sin-meta',
      name: 'sin-meta',
      description: '',
    })
  })
})
