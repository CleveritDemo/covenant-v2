import type { Language } from './configSchema'

// Solo hay dos idiomas soportados (Language = 'en' | 'es'); null = no concluyente, decide el caller.

const ES_FUNCTION_WORDS = new Set([
  'que', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'para', 'con', 'como', 'por', 'en', 'se', 'al', 'es', 'son',
  'necesito', 'necesitamos', 'tenemos', 'debe', 'debemos', 'deberíamos',
  'falta', 'faltan', 'sobre', 'más', 'esto', 'este', 'esta', 'estas', 'estos',
  'cómo', 'cuál', 'hacer', 'revisar', 'revisen', 'implementado', 'características',
])

const EN_FUNCTION_WORDS = new Set([
  'the', 'of', 'and', 'to', 'for', 'with', 'that', 'this', 'these', 'those',
  'we', 'i', 'need', 'needs', 'should', 'must', 'is', 'are', 'be', 'on', 'in', 'it',
  'what', 'how', 'review', 'missing', 'feature', 'features', 'implemented', 'about', 'more',
])

const CODE_BLOCK = /```[\s\S]*?```/g
const INLINE_CODE = /`[^`]+`/g
const URL_PATTERN = /https?:\/\/\S+/gi
const FILE_EXTENSION = /\.[a-z0-9]{1,10}$/i
const TOKEN_SPLIT = /[^\p{L}\p{N}ñáéíóúü]+/u
const STRONG_ES_CHAR = /[ñáéíóú¿¡]/g

function strongSpanishScore(text: string): number {
  const matches = text.match(STRONG_ES_CHAR)
  if (!matches) return 0
  return Math.min(matches.length * 3, 6)
}

function cleanForScoring(raw: string): string {
  return raw
    .replace(CODE_BLOCK, ' ')
    .replace(INLINE_CODE, ' ')
    .replace(URL_PATTERN, ' ')
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter(token => token.length > 0)
    .filter(token => !token.includes('/') && !token.includes('\\') && !FILE_EXTENSION.test(token))
}

export function detectTextLanguage(raw: string): Language | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const sample = trimmed.slice(0, 2000)
  const cleaned = cleanForScoring(sample)
  const tokens = tokenize(cleaned)

  let scoreES = strongSpanishScore(cleaned)
  let scoreEN = 0

  for (const token of tokens) {
    if (ES_FUNCTION_WORDS.has(token)) scoreES++
    if (EN_FUNCTION_WORDS.has(token)) scoreEN++
  }

  const diff = scoreES - scoreEN
  if (Math.abs(diff) < 2) return null
  return diff > 0 ? 'es' : 'en'
}
