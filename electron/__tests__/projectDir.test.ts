import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectDirName, projectDirPath } from '../projectDir'
import { LEGACY_PROJECT_DIR, PROJECT_DIR } from '../../src/shared/projectDir'

const roots: string[] = []

function makeRoot(dirs: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'project-dir-'))
  roots.push(root)
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true })
})

describe('projectDirName', () => {
  it('usa el nombre nuevo en un proyecto sin ninguna de las dos carpetas', () => {
    expect(projectDirName(makeRoot([]))).toBe(PROJECT_DIR)
  })

  it('usa el nombre nuevo cuando ya existe', () => {
    expect(projectDirName(makeRoot([PROJECT_DIR]))).toBe(PROJECT_DIR)
  })

  it('cae al nombre legacy si el proyecto solo tiene el antiguo', () => {
    expect(projectDirName(makeRoot([LEGACY_PROJECT_DIR]))).toBe(LEGACY_PROJECT_DIR)
  })

  it('prefiere el nuevo si el proyecto tiene las dos (nunca devuelve ambas)', () => {
    expect(projectDirName(makeRoot([PROJECT_DIR, LEGACY_PROJECT_DIR]))).toBe(PROJECT_DIR)
  })

  it('projectDirPath cuelga los segmentos de la carpeta resuelta', () => {
    const root = makeRoot([LEGACY_PROJECT_DIR])
    expect(projectDirPath(root, 'agents', 'qa.json'))
      .toBe(join(root, LEGACY_PROJECT_DIR, 'agents', 'qa.json'))
  })
})
