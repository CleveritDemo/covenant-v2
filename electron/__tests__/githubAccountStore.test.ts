import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const mockState = vi.hoisted(() => ({
  userDataDir: '',
  encryptionAvailable: false,
}))

vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => mockState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { readAccountToken, writeAccountToken, deleteAccountToken, listAccountTokenIds } = await import('../githubAccountStore')

describe('githubAccountStore', () => {
  it('ida y vuelta: lee el token que se escribió', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = true

    writeAccountToken('acc-1', 'tok-123')
    expect(readAccountToken('acc-1')).toBe('tok-123')
  })

  it('sin cifrado escribe en claro; con cifrado el token no queda legible en disco', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = false
    writeAccountToken('acc-1', 'super-secreto')
    const plainRaw = readFileSync(join(mockState.userDataDir, 'github-tokens.json'), 'utf8')
    expect(JSON.parse(plainRaw).plain['acc-1']).toBe('super-secreto')
    expect(readAccountToken('acc-1')).toBe('super-secreto')

    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = true
    writeAccountToken('acc-1', 'super-secreto')
    const encRaw = readFileSync(join(mockState.userDataDir, 'github-tokens.json'), 'utf8')
    expect(encRaw).not.toContain('super-secreto')
    expect(readAccountToken('acc-1')).toBe('super-secreto')
  })

  it('id desconocido o token vacío → null; borrar no toca a los demás', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = true
    writeAccountToken('acc-1', 'tok-1')
    writeAccountToken('acc-2', 'tok-2')
    expect(readAccountToken('ghost')).toBeNull()
    writeFileSync(
      join(mockState.userDataDir, 'github-tokens.json'),
      JSON.stringify({ plain: { empty: '  ' } }),
      'utf8',
    )
    mockState.encryptionAvailable = false
    expect(readAccountToken('empty')).toBeNull()

    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = true
    writeAccountToken('acc-1', 'tok-1')
    writeAccountToken('acc-2', 'tok-2')
    deleteAccountToken('acc-1')
    expect(readAccountToken('acc-1')).toBeNull()
    expect(readAccountToken('acc-2')).toBe('tok-2')
  })

  it('listAccountTokenIds: claves con token no vacío, en orden de inserción', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-gh-acc-'))
    mockState.encryptionAvailable = false
    writeFileSync(
      join(mockState.userDataDir, 'github-tokens.json'),
      JSON.stringify({ plain: { 'acc-b': 'tok-b', 'acc-a': 'tok-a', empty: '  ', skip: '' } }),
      'utf8',
    )
    expect(listAccountTokenIds()).toEqual(['acc-b', 'acc-a'])
  })
})
