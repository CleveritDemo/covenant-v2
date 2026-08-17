import { AGENT_RULE_MAX_LENGTH, AGENT_RULES_MAX_COUNT } from './agentIdentity'

const LEADING_BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/

/** Parte el portapapeles en reglas: una por línea, sin dedupe. */
export function splitPastedRules(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim().replace(LEADING_BULLET, '').trim().slice(0, AGENT_RULE_MAX_LENGTH)
    if (text) out.push(text)
  }
  return out
}

export function applyPastedRules(args: {
  rules: string[]
  rulesEnabled: boolean[]
  index: number
  before: string
  after: string
  lines: string[]
}): { rules: string[]; rulesEnabled: boolean[]; dropped: number } {
  const { rules, rulesEnabled, index, before, after, lines } = args
  const composed = lines.length === 1
    ? [before + lines[0] + after]
    : lines.map((line, i) => {
      if (i === 0) return before + line
      if (i === lines.length - 1) return line + after
      return line
    })
  const block = composed.map(item => item.slice(0, AGENT_RULE_MAX_LENGTH))
  const capacity = AGENT_RULES_MAX_COUNT - (rules.length - 1)
  let dropped = 0
  let kept = block
  if (block.length > capacity) {
    dropped = block.length - Math.max(0, capacity)
    kept = block.slice(0, Math.max(0, capacity))
    if (kept.length > 0) {
      const last = kept.length - 1
      kept[last] = (kept[last] + after).slice(0, AGENT_RULE_MAX_LENGTH)
    }
  }
  const originalFlag = rulesEnabled[index] ?? true
  return {
    rules: [...rules.slice(0, index), ...kept, ...rules.slice(index + 1)],
    rulesEnabled: [
      ...rulesEnabled.slice(0, index),
      ...kept.map((_, i) => (i === 0 ? originalFlag : true)),
      ...rulesEnabled.slice(index + 1),
    ],
    dropped,
  }
}
