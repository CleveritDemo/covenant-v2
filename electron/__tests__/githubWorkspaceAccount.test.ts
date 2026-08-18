import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  readWorkspaceAccountId,
  resolveWorkspaceAccountId,
  writeWorkspaceAccountId,
} from '../githubWorkspaceAccount'

describe('githubWorkspaceAccount', () => {
  it('ida y vuelta por .gravity/github.json; null borra el archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    expect(readWorkspaceAccountId(dir)).toBeNull()

    writeWorkspaceAccountId(dir, 'acc-1')
    expect(readWorkspaceAccountId(dir)).toBe('acc-1')
    const raw = readFileSync(join(dir, '.gravity', 'github.json'), 'utf8')
    expect(JSON.parse(raw)).toEqual({ accountId: 'acc-1' })
    expect(raw).not.toMatch(/token|password|secret/i)

    writeWorkspaceAccountId(dir, null)
    expect(existsSync(join(dir, '.gravity', 'github.json'))).toBe(false)
    expect(readWorkspaceAccountId(dir)).toBeNull()
  })

  it('JSON roto = sin cuenta, no lanza', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    mkdirSync(join(dir, '.gravity'))
    writeFileSync(join(dir, '.gravity', 'github.json'), '{ roto', 'utf8')
    expect(readWorkspaceAccountId(dir)).toBeNull()
  })
})

describe('resolveWorkspaceAccountId', () => {
  it('id conocido: lo devuelve y no reescribe el archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    const path = join(dir, '.gravity', 'github.json')
    mkdirSync(join(dir, '.gravity'))
    const original = '{"accountId":"acc-1","keep":true}\n'
    writeFileSync(path, original, 'utf8')
    expect(resolveWorkspaceAccountId(dir, ['acc-1', 'acc-2'])).toBe('acc-1')
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('id desconocido: null y borra el archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    writeWorkspaceAccountId(dir, 'ghost')
    expect(existsSync(join(dir, '.gravity', 'github.json'))).toBe(true)
    expect(resolveWorkspaceAccountId(dir, ['acc-1'])).toBeNull()
    expect(existsSync(join(dir, '.gravity', 'github.json'))).toBe(false)
  })

  it('sin archivo: null sin crear nada', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    expect(resolveWorkspaceAccountId(dir, ['acc-1'])).toBeNull()
    expect(existsSync(join(dir, '.gravity'))).toBe(false)
    expect(existsSync(join(dir, '.gravity', 'github.json'))).toBe(false)
  })

  it('JSON roto: null sin lanzar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-ws-'))
    mkdirSync(join(dir, '.gravity'))
    const path = join(dir, '.gravity', 'github.json')
    writeFileSync(path, '{ roto', 'utf8')
    expect(resolveWorkspaceAccountId(dir, ['acc-1'])).toBeNull()
    expect(existsSync(path)).toBe(true)
  })
})
