import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { deletePreview, listPreviews, readPreview } from '../previewsStore'
import { PREVIEW_MAX_BYTES } from '../../src/shared/previews'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('previewsStore', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-previews-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const previewsDir = (cwd: string): string => join(cwd, PROJECT_DIR, 'previews')

  it('lista vacía si el dir no existe', () => {
    expect(listPreviews(tempCwd())).toEqual({ ok: true, previews: [] })
  })

  it('ordena por mtime desc', () => {
    const cwd = tempCwd()
    const dir = previewsDir(cwd)
    mkdirSync(dir, { recursive: true })
    const older = join(dir, 'older.html')
    const newer = join(dir, 'newer.html')
    writeFileSync(older, '<title>Older</title>')
    writeFileSync(newer, '<title>Newer</title>')
    const now = Date.now() / 1000
    utimesSync(older, now - 100, now - 100)
    utimesSync(newer, now, now)
    const result = listPreviews(cwd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.previews.map(p => p.fileName)).toEqual(['newer.html', 'older.html'])
    }
  })

  it('rechaza traversal', () => {
    const cwd = tempCwd()
    expect(readPreview(cwd, '../../etc/passwd').ok).toBe(false)
    expect(deletePreview(cwd, '../../etc/passwd').ok).toBe(false)
  })

  it('rechaza archivo sobre el cap', () => {
    const cwd = tempCwd()
    const dir = previewsDir(cwd)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'big.html'), 'x'.repeat(PREVIEW_MAX_BYTES + 1))
    const result = readPreview(cwd, 'big.html')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(String(PREVIEW_MAX_BYTES))
    }
  })

  it('delete borra el archivo', () => {
    const cwd = tempCwd()
    const dir = previewsDir(cwd)
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, 'remove-me.html')
    writeFileSync(filePath, '<html></html>')
    expect(deletePreview(cwd, 'remove-me.html')).toEqual({ ok: true })
    expect(existsSync(filePath)).toBe(false)
  })
})
