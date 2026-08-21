/**
 * La cabecera `## Delegation brief` y el markdown de una línea no son texto humano:
 * las mini cards y la cola necesitan el objetivo del encargo, no el boilerplate del host.
 * Funciones puras, sin I/O.
 */

import { looksLikeDelegationBrief, parseDelegationBrief } from './delegationBriefCard'

/** Una línea: quita markdown inline y marcadores de inicio (encabezado, cita, viñeta). */
export function stripMarkdownForSnippet(line: string): string {
  const stripped = line
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
  return stripped.trim()
}

/** Primera línea útil: objetivo del brief o texto humano, sin descartar palabras del usuario. */
export function firstUsefulPromptLine(text: string): string {
  const source = looksLikeDelegationBrief(text)
    ? (parseDelegationBrief(text)?.objective ?? '')
    : text
  for (const raw of source.split('\n')) {
    const line = stripMarkdownForSnippet(raw)
    if (line) return line
  }
  return ''
}
