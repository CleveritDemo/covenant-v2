import { describe, expect, it } from 'vitest'
import type { TabContext } from '../tabContext'
import { isContextDraftDirty } from '../contextDraftDirty'

function context(overrides: Partial<TabContext> = {}): TabContext {
  return {
    id: 'iaterminal:files:src',
    name: 'Source files',
    fileName: 'source-files.md',
    kind: 'files',
    ...overrides,
  }
}

describe('isContextDraftDirty', () => {
  it('is not dirty when the draft is null (modal closed)', () => {
    expect(isContextDraftDirty({
      draft: null,
      initial: null,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(false)
  })

  it('edit: no changes against the starting context is not dirty', () => {
    const original = context()
    expect(isContextDraftDirty({
      draft: { ...original },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(false)
  })

  it('edit: any field change against the starting context is dirty', () => {
    const original = context()
    expect(isContextDraftDirty({
      draft: { ...original, name: 'Renamed' },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
  })

  it('edit: an icon or color change is dirty', () => {
    const original = context({ icon: 'folder', color: '#336699' })
    expect(isContextDraftDirty({
      draft: { ...original, color: '#993366' },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
    expect(isContextDraftDirty({
      draft: { ...original, icon: 'file' },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
  })

  it('create: an empty name is not dirty', () => {
    expect(isContextDraftDirty({
      draft: context({ name: '' }),
      initial: null,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(false)
  })

  it('create: any typed name is dirty, even before touching anything else', () => {
    expect(isContextDraftDirty({
      draft: context({ name: 'W' }),
      initial: null,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
  })

  it('create + notes: typed body content is dirty even with no name yet', () => {
    expect(isContextDraftDirty({
      draft: context({ kind: 'notes', name: '' }),
      initial: null,
      notesContent: 'Some durable knowledge',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
  })

  it('create + notes: whitespace-only body is not dirty', () => {
    expect(isContextDraftDirty({
      draft: context({ kind: 'notes', name: '' }),
      initial: null,
      notesContent: '   \n  ',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(false)
  })

  it('edit + notes: editing only the body (name untouched) is dirty', () => {
    // This is the hole the literal brief formula left open: it only checked
    // notes content in `create` mode, so touching just the textarea of an
    // already-existing note in `edit` mode never tripped `isDirty`.
    const original = context({ kind: 'notes', name: 'Design decisions' })
    expect(isContextDraftDirty({
      draft: { ...original },
      initial: original,
      notesContent: 'Updated body text',
      initialNotesContent: 'Original body text',
      readOnly: false,
    })).toBe(true)
  })

  it('edit + notes: leaving the body exactly as loaded is not dirty', () => {
    const original = context({ kind: 'notes', name: 'Design decisions' })
    expect(isContextDraftDirty({
      draft: { ...original },
      initial: original,
      notesContent: 'Same body',
      initialNotesContent: 'Same body',
      readOnly: false,
    })).toBe(false)
  })

  it('edit: renaming a saved changelog is dirty — only agentResult is read-only', () => {
    // El caso se decidió pensando en agentResult (donde no hay nada que
    // guardar) y se extendió a changelog sin ver que ahí el nombre sí es
    // editable y guardable: el Input se renderiza y el botón Guardar se
    // muestra. Con readOnly:true el cambio se perdía en silencio al pulsar Esc.
    const original = context({ kind: 'changelog', name: 'AI Changelog', fileName: 'changelog.md' })
    expect(isContextDraftDirty({
      draft: { ...original, name: 'Bitácora', fileName: 'bitacora.md' },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: false,
    })).toBe(true)
  })

  it('agentResult is never dirty, regardless of draft differences', () => {
    const original = context({ kind: 'agentResult', name: 'fullstack' })
    expect(isContextDraftDirty({
      draft: { ...original, name: 'Renamed result' },
      initial: original,
      notesContent: '',
      initialNotesContent: '',
      readOnly: true,
    })).toBe(false)
  })

  it('agentResult ignores notes-body differences too', () => {
    // agentResult never has an editable body through this modal, but the
    // contract must hold even if some caller passed mismatched notes values.
    const original = context({ kind: 'agentResult', name: 'fullstack' })
    expect(isContextDraftDirty({
      draft: original,
      initial: original,
      notesContent: 'stray text',
      initialNotesContent: '',
      readOnly: true,
    })).toBe(false)
  })
})
