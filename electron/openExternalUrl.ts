import { shell } from 'electron'

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function openExternalHttpUrl(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!raw.trim()) {
    return { ok: false, error: 'URL vacía' }
  }
  if (!isHttpUrl(raw)) {
    return { ok: false, error: 'Solo se permiten http(s)' }
  }
  try {
    await shell.openExternal(raw.trim())
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
