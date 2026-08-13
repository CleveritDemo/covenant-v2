import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PROJECT_DIR } from '../../src/shared/projectDir'
import { ensureJiraGitignore } from '../jiraGitignore'

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-gitignore-'))
  mkdirSync(join(dir, '.git'), { recursive: true })
  return dir
}

const RULE = `${PROJECT_DIR}/jira/`

describe('ensureJiraGitignore', () => {
  it('añade la regla al final de un .gitignore existente', () => {
    const dir = repo()
    writeFileSync(join(dir, '.gitignore'), 'node_modules\ndist\n', 'utf8')

    expect(ensureJiraGitignore(dir)).toBe('appended')

    const content = readFileSync(join(dir, '.gitignore'), 'utf8')
    expect(content).toContain(RULE)
    // No reescribe: lo que ya había sigue ahí, en su sitio.
    expect(content.startsWith('node_modules\ndist\n')).toBe(true)
  })

  it('sin salto de línea final, no pega la regla a la última entrada', () => {
    const dir = repo()
    writeFileSync(join(dir, '.gitignore'), 'dist', 'utf8')

    ensureJiraGitignore(dir)

    const lines = readFileSync(join(dir, '.gitignore'), 'utf8').split('\n')
    expect(lines).toContain('dist')
    expect(lines).toContain(RULE)
  })

  it('si ya está ignorado, no duplica nada (no-op)', () => {
    const dir = repo()
    const original = `node_modules\n${RULE}\n`
    writeFileSync(join(dir, '.gitignore'), original, 'utf8')

    expect(ensureJiraGitignore(dir)).toBe('already-ignored')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe(original)
  })

  it('la carpeta del proyecto entera ya ignorada también cuenta', () => {
    const dir = repo()
    const original = `${PROJECT_DIR}/\n`
    writeFileSync(join(dir, '.gitignore'), original, 'utf8')

    expect(ensureJiraGitignore(dir)).toBe('already-ignored')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe(original)
  })

  it('una regla con barra inicial es la misma regla para git', () => {
    const dir = repo()
    writeFileSync(join(dir, '.gitignore'), `/${PROJECT_DIR}/jira\n`, 'utf8')
    expect(ensureJiraGitignore(dir)).toBe('already-ignored')
  })

  it('la regla comentada NO cuenta como ignorada', () => {
    const dir = repo()
    writeFileSync(join(dir, '.gitignore'), `# ${RULE}\n`, 'utf8')
    expect(ensureJiraGitignore(dir)).toBe('appended')
  })

  it('sin .gitignore pero con repo git, lo crea con la regla', () => {
    const dir = repo()

    expect(ensureJiraGitignore(dir)).toBe('appended')
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain(RULE)
  })

  it('sin .gitignore y sin repo git, no crea nada', () => {
    // No hay commit accidental que evitar y dejar un archivo nuevo en la
    // carpeta de otro es ensuciarla.
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-nogit-'))

    expect(ensureJiraGitignore(dir)).toBe('skipped')
    expect(existsSync(join(dir, '.gitignore'))).toBe(false)
  })

  it('cwd vacío: no toca nada', () => {
    expect(ensureJiraGitignore('')).toBe('skipped')
  })

  it('un .gitignore que no se puede escribir no lanza', () => {
    // El componente de ruta es un archivo: cualquier escritura da ENOTDIR.
    const blocker = mkdtempSync(join(tmpdir(), 'gravity-jira-blocker-'))
    const notADir = join(blocker, 'archivo')
    writeFileSync(notADir, 'x', 'utf8')

    expect(ensureJiraGitignore(join(notADir, 'sub'))).toBe('skipped')
  })
})
