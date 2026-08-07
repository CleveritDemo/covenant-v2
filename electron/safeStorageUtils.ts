/**
 * Utilidades para cifrar/descifrar valores de texto con Electron safeStorage (Keychain/OS keyring).
 * Cuando el cifrado no está disponible (CI, headless) se retorna el valor en texto plano
 * con un marcador distinto para que readConfig() lo maneje correctamente.
 *
 * Formato cifrado: 'enc:v1:<base64>'
 * Valor plano (fallback): el string original sin prefijo
 */

import { safeStorage } from 'electron'

const ENC_PREFIX = 'enc:v1:'

/** Cifra un string. Si safeStorage no está disponible devuelve el original sin cifrar. */
export function encryptField(value: string): string {
  if (!value) return value
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(value)
    return ENC_PREFIX + buf.toString('base64')
  }
  return value
}

/** Descifra un string cifrado con encryptField. Si no tiene el prefijo lo devuelve tal cual. */
export function decryptField(value: string): string {
  if (!value) return value
  if (value.startsWith(ENC_PREFIX)) {
    try {
      const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64')
      return safeStorage.decryptString(buf)
    } catch {
      return ''
    }
  }
  return value
}

/** Devuelve true si el valor ya está cifrado con este esquema. */
export function isEncryptedField(value: string): boolean {
  return value.startsWith(ENC_PREFIX)
}
