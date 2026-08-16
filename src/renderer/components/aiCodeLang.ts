import { cssLanguage } from '@codemirror/lang-css'
import { htmlLanguage } from '@codemirror/lang-html'
import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage,
} from '@codemirror/lang-javascript'
import { jsonLanguage } from '@codemirror/lang-json'
import { markdownLanguage } from '@codemirror/lang-markdown'
import { pythonLanguage } from '@codemirror/lang-python'
import { rustLanguage } from '@codemirror/lang-rust'
import { yamlLanguage } from '@codemirror/lang-yaml'
import type { Language } from '@codemirror/language'

/** Alias de fence → parser Lezer (lenguajes populares en respuestas de agente). */
const LANG_MAP: Record<string, Language> = {
  javascript: javascriptLanguage,
  js: javascriptLanguage,
  jsx: jsxLanguage,
  typescript: typescriptLanguage,
  ts: typescriptLanguage,
  tsx: tsxLanguage,
  json: jsonLanguage,
  python: pythonLanguage,
  py: pythonLanguage,
  css: cssLanguage,
  html: htmlLanguage,
  htm: htmlLanguage,
  yaml: yamlLanguage,
  yml: yamlLanguage,
  rust: rustLanguage,
  rs: rustLanguage,
  markdown: markdownLanguage,
  md: markdownLanguage,
}

export const SHELL_LANGS = new Set([
  'bash', 'sh', 'zsh', 'shell', 'console', 'terminal', 'fish', 'ksh', 'csh',
])

export function normalizeAiCodeLang(lang: string): string {
  return lang.trim().toLowerCase().split(/[\s{]/)[0] ?? ''
}

export function resolveAiCodeLanguage(lang: string): Language | null {
  const key = normalizeAiCodeLang(lang)
  if (!key) return null
  return LANG_MAP[key] ?? null
}

export function isShellAiCodeLang(lang: string): boolean {
  return SHELL_LANGS.has(normalizeAiCodeLang(lang))
}
