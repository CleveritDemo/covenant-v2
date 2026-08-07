/**
 * Persiste la sesión Covenant (jwt + credenciales) cifrada con safeStorage en
 * userData/covenant-session.enc para que al reiniciar la app el usuario no tenga
 * que hacer sign-in de nuevo.
 *
 * Diseño:
 * - Los datos se serializan a JSON, se cifran como un único Buffer y se guardan en base64.
 * - Si el cifrado no está disponible (headless/CI), se guarda igualmente pero sin cifrar,
 *   ya que el archivo vive en el espacio privado del usuario.
 * - Se exportan las cuatro funciones que main.ts y covenantApi.ts necesitan.
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface CovenantSessionData {
  jwt: string
  login: string
  avatarUrl: string
  githubId: string | number
  githubToken: string
}

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'covenant-session.enc')
}

/** Guarda la sesión cifrada en disco. */
export function persistCovenantSession(data: CovenantSessionData): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const json = JSON.stringify(data)
    let payload: string
    if (safeStorage.isEncryptionAvailable()) {
      payload = safeStorage.encryptString(json).toString('base64')
    } else {
      payload = Buffer.from(json, 'utf-8').toString('base64')
    }
    writeFileSync(sessionFilePath(), payload, 'utf-8')
  } catch {
    /* fallo silencioso: sin persistencia, se requiere re-login */
  }
}

/** Elimina el archivo de sesión cifrada (llamado en signOut). */
export function clearCovenantSession(): void {
  try {
    const p = sessionFilePath()
    if (existsSync(p)) rmSync(p)
  } catch {
    /* ignorar */
  }
}

/**
 * Lee y descifra la sesión persistida. Devuelve null si no existe, falla el descifrado
 * o los datos están incompletos. Se llama desde initCovenantSession al arrancar la app.
 */
export function loadCovenantSession(): CovenantSessionData | null {
  try {
    const p = sessionFilePath()
    if (!existsSync(p)) return null
    const payload = readFileSync(p, 'utf-8').trim()
    let json: string
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(payload, 'base64')
      json = safeStorage.decryptString(buf)
    } else {
      json = Buffer.from(payload, 'base64').toString('utf-8')
    }
    const data = JSON.parse(json) as Partial<CovenantSessionData>
    if (!data.jwt || !data.githubToken) return null
    return {
      jwt: data.jwt,
      login: data.login ?? '',
      avatarUrl: data.avatarUrl ?? '',
      githubId: data.githubId ?? '',
      githubToken: data.githubToken,
    }
  } catch {
    return null
  }
}
