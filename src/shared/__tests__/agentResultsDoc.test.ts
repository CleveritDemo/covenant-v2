import { describe, expect, it } from 'vitest'
import {
  groupLogEntriesByDay,
  isAgentResultsDocEmpty,
  parseAgentResultsDoc,
  withAgentResultsNotes,
} from '../agentResultsDoc'

/** Documento tal como lo escribe formatAiAgentResultsDocument(). */
const filled = [
  '# PO — Results',
  '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:po","kind":"agentResult"} -->',
  '',
  '<!-- iaterminal:auto -->',
  '## Latest',
  'Tres historias aceptadas, una devuelta a refinamiento.',
  '',
  '## Log',
  '- `2026-08-06T14:22:10Z` — Acepté GRV-118.',
  '- `2026-08-06T13:40:02Z` — Prioricé el spike de results/.',
  '- `2026-08-05T18:12:33Z` — Definí el alcance del sprint.',
  '<!-- /iaterminal:auto -->',
  '',
  '<!-- iaterminal:notes -->',
  'No cerrar GRV-121 sin revisar con @fullstack.',
  '<!-- /iaterminal:notes -->',
  '',
].join('\n')

const fresh = [
  '# PO — Results',
  '<!-- iaterminal:auto -->',
  '## Latest',
  '(no results yet)',
  '',
  '## Log',
  '- (no entries yet)',
  '<!-- /iaterminal:auto -->',
  '',
  '<!-- iaterminal:notes -->',
  '(no annotations yet)',
  '<!-- /iaterminal:notes -->',
].join('\n')

describe('parseAgentResultsDoc', () => {
  it('extracts summary, log and notes without the markers', () => {
    const doc = parseAgentResultsDoc(filled)
    expect(doc.summary).toBe('Tres historias aceptadas, una devuelta a refinamiento.')
    expect(doc.notes).toBe('No cerrar GRV-121 sin revisar con @fullstack.')
    expect(doc.entries).toEqual([
      { timestamp: '2026-08-06T14:22:10Z', text: 'Acepté GRV-118.' },
      { timestamp: '2026-08-06T13:40:02Z', text: 'Prioricé el spike de results/.' },
      { timestamp: '2026-08-05T18:12:33Z', text: 'Definí el alcance del sprint.' },
    ])
    expect(isAgentResultsDocEmpty(doc)).toBe(false)
  })

  it('treats host placeholders as empty', () => {
    const doc = parseAgentResultsDoc(fresh)
    expect(doc).toEqual({ summary: null, entries: [], notes: null })
    expect(isAgentResultsDocEmpty(doc)).toBe(true)
  })

  it('rewrites only the notes region', () => {
    const next = withAgentResultsNotes(filled, '  Bloquea GRV-121.  ')
    const auto = (raw: string) => raw.slice(raw.indexOf('<!-- iaterminal:auto -->'), raw.indexOf('<!-- /iaterminal:auto -->'))
    expect(auto(next)).toBe(auto(filled))
    expect(parseAgentResultsDoc(next).notes).toBe('Bloquea GRV-121.')
    expect(parseAgentResultsDoc(next).summary).toBe(parseAgentResultsDoc(filled).summary)
  })

  it('restores the placeholder when notes are cleared and adds the region if missing', () => {
    expect(parseAgentResultsDoc(withAgentResultsNotes(filled, '   ')).notes).toBeNull()
    const bare = '# PO — Results\n<!-- iaterminal:auto -->\n## Latest\nAlgo.\n<!-- /iaterminal:auto -->\n'
    const patched = withAgentResultsNotes(bare, 'Nota nueva.')
    expect(patched.startsWith(bare.trimEnd())).toBe(true)
    expect(parseAgentResultsDoc(patched).notes).toBe('Nota nueva.')
  })

  it('groups consecutive entries by local day', () => {
    const groups = groupLogEntriesByDay(parseAgentResultsDoc(filled).entries)
    expect(groups.map(group => group.entries.length)).toEqual([2, 1])
    expect(groups[0].day).not.toBe(groups[1].day)
  })
})
