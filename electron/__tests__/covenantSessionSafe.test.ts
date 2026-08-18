/**
 * Tests unitarios para safeStorageUtils (cifrado/descifrado de campos)
 * y covenantSession (persistencia/rehidratación de sesión).
 *
 * Mockea safeStorage de electron para que los tests no dependan de Keychain real.
 */
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- mock de electron ---
const mockEncrypt = vi.fn((value: string) => Buffer.from(`__enc__${value}`, 'utf-8'))
const mockDecrypt = vi.fn((buf: Buffer) => buf.toString('utf-8').replace(/^__enc__/, ''))
const mockIsAvailable = vi.fn(() => true)

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockIsAvailable(),
    encryptString: (v: string) => mockEncrypt(v),
    decryptString: (b: Buffer) => mockDecrypt(b),
  },
  app: {
    getPath: (_k: string) => tempDir,
  },
}))

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'covenant-session-test-'))
  vi.resetModules()
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
  vi.clearAllMocks()
})

// ---------- safeStorageUtils ----------
describe('safeStorageUtils', () => {
  it('cifra un valor con el prefijo enc:v1:', async () => {
    const { encryptField, isEncryptedField } = await import('../safeStorageUtils')
    const result = encryptField('my-secret')
    expect(result.startsWith('enc:v1:')).toBe(true)
    expect(isEncryptedField(result)).toBe(true)
  })

  it('descifra un valor cifrado y recupera el original', async () => {
    const { encryptField, decryptField } = await import('../safeStorageUtils')
    const encrypted = encryptField('my-secret')
    expect(decryptField(encrypted)).toBe('my-secret')
  })

  it('devuelve el valor sin cambios si no tiene prefijo enc:v1:', async () => {
    const { decryptField } = await import('../safeStorageUtils')
    expect(decryptField('plaintext')).toBe('plaintext')
  })

  it('no cifra strings vacíos', async () => {
    const { encryptField } = await import('../safeStorageUtils')
    expect(encryptField('')).toBe('')
  })

  it('devuelve string vacío si el descifrado lanza', async () => {
    mockDecrypt.mockImplementationOnce(() => { throw new Error('bad') })
    const { decryptField } = await import('../safeStorageUtils')
    const enc = 'enc:v1:' + Buffer.from('bad-data').toString('base64')
    expect(decryptField(enc)).toBe('')
  })

  it('usa texto plano cuando isEncryptionAvailable es false', async () => {
    mockIsAvailable.mockReturnValueOnce(false)
    const { encryptField, isEncryptedField } = await import('../safeStorageUtils')
    const result = encryptField('plain-val')
    expect(result).toBe('plain-val')
    expect(isEncryptedField(result)).toBe(false)
  })
})

// ---------- covenantSession ----------
const sessionA = {
  jwt: 'jwt-a',
  login: 'userA',
  avatarUrl: 'https://a.url',
  githubId: 1,
  githubToken: 'ghp_a',
}
const sessionB = {
  jwt: 'jwt-b',
  login: 'userB',
  avatarUrl: 'https://b.url',
  githubId: 2,
  githubToken: 'ghp_b',
}

describe('covenantSession', () => {
  it('guarda y lee dos cuentas independientes', async () => {
    const { persistCovenantSession, loadCovenantSessions } = await import('../covenantSession')
    persistCovenantSession('acc-a', sessionA)
    persistCovenantSession('acc-b', sessionB)
    const loaded = loadCovenantSessions()
    expect(loaded['acc-a']?.jwt).toBe('jwt-a')
    expect(loaded['acc-a']?.githubToken).toBe('ghp_a')
    expect(loaded['acc-b']?.jwt).toBe('jwt-b')
    expect(loaded['acc-b']?.login).toBe('userB')
  })

  it('devuelve {} si no existe el archivo nuevo', async () => {
    const { loadCovenantSessions } = await import('../covenantSession')
    expect(loadCovenantSessions()).toEqual({})
  })

  it('clearCovenantSession borra solo esa cuenta', async () => {
    const { persistCovenantSession, clearCovenantSession, loadCovenantSessions } = await import('../covenantSession')
    persistCovenantSession('acc-a', sessionA)
    persistCovenantSession('acc-b', sessionB)
    clearCovenantSession('acc-a')
    const loaded = loadCovenantSessions()
    expect(loaded['acc-a']).toBeUndefined()
    expect(loaded['acc-b']?.jwt).toBe('jwt-b')
  })

  it('migra covenant-session.enc bajo la clave dada y no borra el original', async () => {
    const { existsSync, writeFileSync } = await import('fs')
    const json = JSON.stringify({
      jwt: 'legacy-jwt',
      login: 'legacy',
      avatarUrl: '',
      githubId: 9,
      githubToken: 'ghp_legacy',
    })
    const payload = mockEncrypt(json).toString('base64')
    writeFileSync(join(tempDir, 'covenant-session.enc'), payload, 'utf-8')
    const { loadCovenantSessions } = await import('../covenantSession')
    const loaded = loadCovenantSessions('acc-default')
    expect(loaded['acc-default']?.jwt).toBe('legacy-jwt')
    expect(loaded['acc-default']?.githubToken).toBe('ghp_legacy')
    expect(existsSync(join(tempDir, 'covenant-session.enc'))).toBe(true)
    expect(existsSync(join(tempDir, 'covenant-sessions.enc'))).toBe(true)
  })

  it('devuelve {} si falla el descifrado (archivo corrupto)', async () => {
    mockDecrypt.mockImplementationOnce(() => { throw new Error('decrypt failed') })
    const { writeFileSync } = await import('fs')
    writeFileSync(join(tempDir, 'covenant-sessions.enc'), 'corrupted-base64!!!', 'utf-8')
    const { loadCovenantSessions } = await import('../covenantSession')
    expect(loadCovenantSessions()).toEqual({})
  })

  it('funciona sin cifrado (isEncryptionAvailable=false) usando base64 plano', async () => {
    mockIsAvailable.mockReturnValue(false)
    const { persistCovenantSession, loadCovenantSessions } = await import('../covenantSession')
    persistCovenantSession('acc-2', { jwt: 'j2', login: 'u2', avatarUrl: '', githubId: 2, githubToken: 'g2' })
    const loaded = loadCovenantSessions()
    expect(loaded['acc-2']?.jwt).toBe('j2')
    expect(loaded['acc-2']?.githubToken).toBe('g2')
  })

  it('clearAllCovenantSessions vacía el store nuevo', async () => {
    const { persistCovenantSession, clearAllCovenantSessions, loadCovenantSessions } = await import('../covenantSession')
    persistCovenantSession('acc-a', sessionA)
    clearAllCovenantSessions()
    expect(loadCovenantSessions()).toEqual({})
  })
})
