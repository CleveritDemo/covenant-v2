import { describe, expect, it } from 'vitest'
import {
  MAX_COMPOSER_HISTORY,
  composerHistoryFromEntries,
  isHostInjectedFollowUp,
  recallStep,
  rememberComposerEntry,
} from '../composerHistory'

const H = ['uno', 'dos', 'tres'] // 'tres' es el más reciente
const idle = { draft: '', stash: '', atFirstLine: true }

describe('rememberComposerEntry', () => {
  it('agrega al final y colapsa el duplicado consecutivo', () => {
    expect(rememberComposerEntry(['a'], 'b')).toEqual(['a', 'b'])
    expect(rememberComposerEntry(['a', 'b'], 'b')).toEqual(['a', 'b'])
    expect(rememberComposerEntry(['a', 'b'], 'a')).toEqual(['a', 'b', 'a'])
  })

  it('ignora vacíos y recorta por el tope', () => {
    expect(rememberComposerEntry(['a'], '   ')).toEqual(['a'])
    const full = Array.from({ length: MAX_COMPOSER_HISTORY }, (_, i) => `m${i}`)
    const next = rememberComposerEntry(full, 'nuevo')
    expect(next).toHaveLength(MAX_COMPOSER_HISTORY)
    expect(next[0]).toBe('m1')
    expect(next[next.length - 1]).toBe('nuevo')
  })
})

describe('composerHistoryFromEntries', () => {
  it('solo toma entradas de usuario', () => {
    expect(composerHistoryFromEntries([
      { role: 'assistant', content: 'hola' },
      { role: 'user', content: 'pregunta' },
      { role: 'system', content: 'sys' },
    ])).toEqual(['pregunta'])
  })

  it('descarta presentation delegationResult', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: 'humano' },
      { role: 'user', content: 'tarjeta', presentation: 'delegationResult' },
    ])).toEqual(['humano'])
  })

  it('colapsa duplicados consecutivos', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ])).toEqual(['a', 'b'])
  })

  it('recorta al tope de 50', () => {
    const entries = Array.from({ length: 52 }, (_, i) => ({
      role: 'user',
      content: `m${i}`,
    }))
    const next = composerHistoryFromEntries(entries)
    expect(next).toHaveLength(MAX_COMPOSER_HISTORY)
    expect(next[0]).toBe('m2')
    expect(next[next.length - 1]).toBe('m51')
  })

  it('descarta vacíos tras trim', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: '   ' },
      { role: 'user', content: 'ok' },
    ])).toEqual(['ok'])
  })

  it('descarta follow-up de delegación por contenido sin presentation', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: 'humano' },
      { role: 'user', content: '## Delegation result\nid: d1\nstatus: ok' },
    ])).toEqual(['humano'])
  })

  it('descarta follow-up de orchestration limit por contenido', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: '## Orchestration limit\nround: 3' },
    ])).toEqual([])
  })

  it('descarta follow-up de delegation fence problem por contenido', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: '## Delegation fence problem\nagent: qa' },
    ])).toEqual([])
  })

  it('conserva mensaje humano que menciona un título de follow-up a mitad de texto', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: 'mira el ## Delegation result que salió' },
    ])).toEqual(['mira el ## Delegation result que salió'])
  })

  it('descarta follow-up con espacios o saltos de línea delante', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: '  \n  ## Delegation result\nid: d1' },
    ])).toEqual([])
  })

  it('mezcla humano + follow-up + humano conserva solo los humanos en orden', () => {
    expect(composerHistoryFromEntries([
      { role: 'user', content: 'primero' },
      { role: 'user', content: '## Delegation result\nid: d1\nstatus: ok' },
      { role: 'user', content: 'segundo' },
    ])).toEqual(['primero', 'segundo'])
  })
})

describe('isHostInjectedFollowUp', () => {
  it('detecta los tres prefijos de follow-up del host', () => {
    expect(isHostInjectedFollowUp('## Delegation result\nid: x')).toBe(true)
    expect(isHostInjectedFollowUp('## Orchestration limit\nround: 1')).toBe(true)
    expect(isHostInjectedFollowUp('## Delegation fence problem\nagent: qa')).toBe(true)
  })

  it('no confunde menciones a mitad de párrafo', () => {
    expect(isHostInjectedFollowUp('mira el ## Delegation result que salió')).toBe(false)
  })
})

describe('recallStep', () => {
  it('↑ desde idle entra al más reciente y guarda el borrador', () => {
    const step = recallStep(H, null, 'ArrowUp', { ...idle, draft: 'a medias' })
    expect(step).toEqual({ index: 0, text: 'tres', stash: 'a medias' })
  })

  it('↑ retrocede y se detiene en el más antiguo', () => {
    expect(recallStep(H, 0, 'ArrowUp', idle)?.text).toBe('dos')
    expect(recallStep(H, 2, 'ArrowUp', idle)).toEqual({ index: 2, text: 'uno', stash: '' })
  })

  it('↑ no entra si el cursor no está en la primera línea, pero sí al navegar', () => {
    expect(recallStep(H, null, 'ArrowUp', { ...idle, atFirstLine: false })).toBeNull()
    expect(recallStep(H, 0, 'ArrowUp', { ...idle, atFirstLine: false })?.index).toBe(1)
  })

  it('↑ sin historial no hace nada', () => {
    expect(recallStep([], null, 'ArrowUp', idle)).toBeNull()
  })

  it('↓ avanza y al pasar el más reciente restaura el borrador', () => {
    const ctx = { ...idle, stash: 'a medias' }
    expect(recallStep(H, 1, 'ArrowDown', ctx)).toEqual({ index: 0, text: 'tres', stash: 'a medias' })
    expect(recallStep(H, 0, 'ArrowDown', ctx)).toEqual({ index: null, text: 'a medias', stash: '' })
  })

  it('↓ y Esc en idle no le pertenecen al historial', () => {
    expect(recallStep(H, null, 'ArrowDown', idle)).toBeNull()
    expect(recallStep(H, null, 'Escape', idle)).toBeNull()
  })

  it('Esc sale y restaura el borrador desde cualquier posición', () => {
    const step = recallStep(H, 2, 'Escape', { ...idle, stash: 'a medias' })
    expect(step).toEqual({ index: null, text: 'a medias', stash: '' })
  })

  it('ignora cualquier otra tecla', () => {
    expect(recallStep(H, 1, 'Enter', idle)).toBeNull()
  })
})
