import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverTabContexts, materializeTabContext } from '../tabContextBuild'
import {
  applyCanonicalContextIdentity,
  CONTEXT_SUBDIR,
  type TabContext,
} from '../../src/shared/tabContext'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('referenceOnly files/spreadsheet contexts', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-ref-only-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const SECRET = 'UNIQUE_SECRET_BODY_XYZ'
  const STUB_MARK = '_(referencia viva: el contenido se lee del disco en cada turno y no se copia aquí)_'

  function filesContext(extra: Partial<TabContext> = {}): TabContext {
    return applyCanonicalContextIdentity({
      id: '',
      name: 'Selected files',
      fileName: '',
      kind: 'files',
      paths: ['src/one.ts'],
      ...extra,
    })
  }

  function seedSource(cwd: string): void {
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), `export const x = '${SECRET}'`, 'utf8')
  }

  it('write:true with referenceOnly writes the stub and not the file body', () => {
    const cwd = tempCwd()
    seedSource(cwd)
    const context = filesContext({ referenceOnly: true })
    const result = materializeTabContext(context, cwd, { write: true })
    expect(result.ok).toBe(true)
    const disk = readFileSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'Selected-files.md'), 'utf8')
    expect(disk).toContain(STUB_MARK)
    expect(disk).toContain('- rootPath: .')
    expect(disk).toContain('- src/one.ts')
    expect(disk).not.toContain(SECRET)
    expect(result.content).not.toContain(SECRET)
  })

  it('write:false with referenceOnly still returns the live file body', () => {
    const cwd = tempCwd()
    seedSource(cwd)
    const context = filesContext({ referenceOnly: true })
    const result = materializeTabContext(context, cwd, { write: false })
    expect(result.ok).toBe(true)
    expect(result.content).toContain(SECRET)
    expect(result.content).not.toContain(STUB_MARK)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'Selected-files.md'))).toBe(false)
  })

  it('keeps section annotations when writing a referenceOnly stub', () => {
    const cwd = tempCwd()
    seedSource(cwd)
    const context = filesContext()
    const created = materializeTabContext(context, cwd, { write: true })
    const raw = readFileSync(created.filePath!, 'utf8')
    writeFileSync(
      created.filePath!,
      raw.replace(
        /<!-- iaterminal:notes -->[\s\S]*?<!-- \/iaterminal:notes -->/,
        '<!-- iaterminal:notes -->\n- `src/one.ts` — keep me\n<!-- /iaterminal:notes -->',
      ),
      'utf8',
    )
    const refreshed = materializeTabContext({ ...context, referenceOnly: true }, cwd, { write: true })
    expect(refreshed.ok).toBe(true)
    const disk = readFileSync(refreshed.filePath!, 'utf8')
    expect(disk).toContain('- `src/one.ts` — keep me')
    expect(disk).not.toContain('## Orphaned')
    expect(disk).toContain(STUB_MARK)
    expect(disk).not.toContain(SECRET)
  })

  it('without referenceOnly the document still copies the file body', () => {
    const cwd = tempCwd()
    seedSource(cwd)
    const context = filesContext()
    const withCopy = materializeTabContext(context, cwd, { write: true })
    const live = materializeTabContext(context, cwd, { write: false })
    expect(withCopy.ok).toBe(true)
    expect(live.ok).toBe(true)
    const disk = readFileSync(withCopy.filePath!, 'utf8')
    expect(disk).toContain(SECRET)
    expect(disk).toContain('### src/one.ts')
    expect(disk).not.toContain(STUB_MARK)
    expect(disk).not.toContain('"referenceOnly"')
    expect(withCopy.content).toBe(live.content)
  })

  it('discover round-trip keeps referenceOnly and the same id', () => {
    const cwd = tempCwd()
    seedSource(cwd)
    const context = filesContext({ referenceOnly: true })
    const id = context.id
    materializeTabContext(context, cwd, { write: true })
    const found = discoverTabContexts(cwd).contexts.find(item => item.id === id)
    expect(found).toBeDefined()
    expect(found?.referenceOnly).toBe(true)
    expect(found?.id).toBe(id)
    expect(found?.id).toBe('iaterminal:files:Selected-files')
  })
})
