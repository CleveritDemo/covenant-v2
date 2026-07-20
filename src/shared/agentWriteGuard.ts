import type { PatchOp, WriteOp } from './agentFileProtocol'

export interface WriteGuardResult {
  allowed: WriteOp[]
  rejected: Array<{ path: string; reason: string }>
}

/** El usuario pidió explícitamente crear o modificar archivos en este turno. */
export function userWantsFileChanges(userMessage: string): boolean {
  const m = userMessage.trim()
  if (!m) return false

  // Preguntas puras sin verbo de edición → no escribir en disco
  const looksLikeQuestionOnly =
    /^(qué|que|cuál|cual|cómo|como|por\s*qué|porque|how|what|why|when|where|explain|explica|dime|cuéntame|tell\s+me)\b/i.test(m) &&
    !/\b(modifica|actualiza|crea|escribe|edita|arregla|corrige|fix|implementa|añade|agrega|write|update|change|genera)\w*\b/i.test(m)
  if (looksLikeQuestionOnly) return false

  const fileChangePatterns = [
    /\b(modifica|actualiza|crea|escribe|edita|arregla|corrige|fix|implementa|añade|agrega|refactoriza|genera|write|update|change)\w*\b/i,
    /\b(archivo|file|readme|componente)\b/i,
    /@[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]{1,12}/,
    /`[^`]+\.[a-zA-Z0-9]{1,12}`/,
    /\bREADME\.md\b/i,
  ]
  return fileChangePatterns.some(r => r.test(m))
}

/** La ruta del WRITE coincide con lo que el usuario pidió en su último mensaje. */
export function pathLikelyRequested(userMessage: string, relPath: string): boolean {
  const path = relPath.replace(/\\/g, '/').toLowerCase()
  const base = path.split('/').pop() ?? path
  const msg = userMessage.toLowerCase()

  if (msg.includes(path)) return true
  if (base.length >= 4 && msg.includes(base)) return true

  if (base === 'readme.md' && /\breadme\b/.test(msg)) return true

  const atPath = `@${path}`
  if (msg.includes(atPath)) return true

  return false
}

const SENSITIVE_PATH_PATTERNS = [
  /(^|\/)\.env(\.|$|\/)/i,
  /\.pem$/i,
  /^credentials/i,
  /^\.git(\/|$)/i,
  /^\.ssh(\/|$)/i,
  /id_rsa/i,
]

export function isSensitiveWritePath(relPath: string): boolean {
  const path = relPath.replace(/\\/g, '/').toLowerCase()
  return SENSITIVE_PATH_PATTERNS.some(r => r.test(path))
}

/** Contenido que no es código real sino razonamiento o ejemplo roto del modelo. */
export function isSuspiciousAgentWriteContent(content: string): boolean {
  const c = content.trim()
  if (!c) return true

  const suspiciousPatterns = [
    /writeFileSync\s*\(/i,
    /unterminated string/i,
    /\bline\s+\d+\s*:/i,
    /\bprobably means\b/i,
    /\blet me look at\b/i,
    /\bthe improvement i should make\b/i,
    /\bconst fileContent\s*=/i,
    /<<<AI_TERMINAL_WRITE/i,
    /<<<END_AI_TERMINAL_WRITE/i,
    /^okay,\s*the user is asking/i,
    /^so,\s*the steps are:/i,
  ]
  if (suspiciousPatterns.some(r => r.test(c))) return true

  // Cadena JS/TS abierta sin cerrar (error típico del bug original)
  if (/^\s*['"`][^'"`]*$/.test(c)) return true

  return false
}

/** Quita bloques de thinking antes de extraer WRITE/RUN/READ. */
export function stripThinkingFromAgentReply(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

/**
 * Filtra operaciones WRITE: solo rutas pedidas por el usuario y contenido válido.
 */
export function filterWritesByUserIntent(
  userMessage: string,
  writes: WriteOp[],
): WriteGuardResult {
  const rejected: Array<{ path: string; reason: string }> = []
  const allowed: WriteOp[] = []

  if (writes.length === 0) return { allowed, rejected }

  const wantsChanges = userWantsFileChanges(userMessage)

  for (const w of writes) {
    if (!wantsChanges) {
      rejected.push({ path: w.path, reason: 'el usuario no pidió cambios en archivos' })
      continue
    }
    if (isSensitiveWritePath(w.path)) {
      rejected.push({ path: w.path, reason: 'ruta sensible bloqueada' })
      continue
    }
    if (!pathLikelyRequested(userMessage, w.path)) {
      rejected.push({ path: w.path, reason: 'ruta no solicitada por el usuario' })
      continue
    }
    if (isSuspiciousAgentWriteContent(w.content)) {
      rejected.push({ path: w.path, reason: 'contenido inválido (parece razonamiento, no código)' })
      continue
    }
    allowed.push(w)
  }

  return { allowed, rejected }
}

export interface PatchGuardResult {
  allowed: PatchOp[]
  rejected: Array<{ path: string; reason: string }>
}

export function filterPatchesByUserIntent(
  userMessage: string,
  patches: PatchOp[],
): PatchGuardResult {
  const rejected: Array<{ path: string; reason: string }> = []
  const allowed: PatchOp[] = []
  const wantsChanges = userWantsFileChanges(userMessage)

  for (const p of patches) {
    if (!wantsChanges) {
      rejected.push({ path: p.path, reason: 'el usuario no pidió cambios en archivos' })
      continue
    }
    if (isSensitiveWritePath(p.path)) {
      rejected.push({ path: p.path, reason: 'ruta sensible bloqueada' })
      continue
    }
    if (!pathLikelyRequested(userMessage, p.path)) {
      rejected.push({ path: p.path, reason: 'ruta no solicitada por el usuario' })
      continue
    }
    allowed.push(p)
  }

  return { allowed, rejected }
}
