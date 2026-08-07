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
describe('covenantSession', () => {
  it('persiste y rehidrata una sesión correctamente', async () => {
    const { persistCovenantSession, loadCovenantSession } = await import('../covenantSession')
    const data = {
      jwt: 'jwt-token',
      login: 'karlUser',
      avatarUrl: 'https://avatar.url',
      githubId: 12345,
      githubToken: 'ghp_xxx',
    }
    persistCovenantSession(data)
    const loaded = loadCovenantSession()
    expect(loaded).not.toBeNull()
    expect(loaded?.jwt).toBe('jwt-token')
    expect(loaded?.login).toBe('karlUser')
    expect(loaded?.githubToken).toBe('ghp_xxx')
  })

  it('devuelve null si no existe el archivo', async () => {
    const { loadCovenantSession } = await import('../covenantSession')
    expect(loadCovenantSession()).toBeNull()
  })

  it('limpia el archivo en clearCovenantSession', async () => {
    const { persistCovenantSession, clearCovenantSession, loadCovenantSession } = await import('../covenantSession')
    persistCovenantSession({ jwt: 'j', login: 'l', avatarUrl: '', githubId: 1, githubToken: 'g' })
    clearCovenantSession()
    expect(loadCovenantSession()).toBeNull()
  })

  it('devuelve null si falla el descifrado (archivo corrupto)', async () => {
    mockDecrypt.mockImplementationOnce(() => { throw new Error('decrypt failed') })
    const { writeFileSync } = await import('fs')
    writeFileSync(join(tempDir, 'covenant-session.enc'), 'corrupted-base64!!!', 'utf-8')
    const { loadCovenantSession } = await import('../covenantSession')
    expect(loadCovenantSession()).toBeNull()
  })

  it('funciona sin cifrado (isEncryptionAvailable=false) usando base64 plano', async () => {
    mockIsAvailable.mockReturnValue(false)
    const { persistCovenantSession, loadCovenantSession } = await import('../covenantSession')
    persistCovenantSession({ jwt: 'j2', login: 'u2', avatarUrl: '', githubId: 2, githubToken: 'g2' })
    const loaded = loadCovenantSession()
    expect(loaded?.jwt).toBe('j2')
    expect(loaded?.githubToken).toBe('g2')
  })
})
