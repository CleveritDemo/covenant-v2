import { describe, expect, it } from 'vitest'
import { isNewTerminalShortcut } from '../newTerminalShortcut'

describe('isNewTerminalShortcut', () => {
  it('⌘Y abre nueva terminal', () => {
    expect(isNewTerminalShortcut({ key: 'y', metaKey: true })).toBe(true)
  })

  it('Ctrl+Y abre nueva terminal', () => {
    expect(isNewTerminalShortcut({ key: 'Y', ctrlKey: true })).toBe(true)
  })

  it('⌘J abre nueva terminal en macOS', () => {
    expect(isNewTerminalShortcut({ key: 'j', metaKey: true })).toBe(true)
  })

  it('Ctrl+J no abre (LF en terminal)', () => {
    expect(isNewTerminalShortcut({ key: 'j', ctrlKey: true })).toBe(false)
  })

  it('⌥⌘J no abre', () => {
    expect(isNewTerminalShortcut({ key: 'j', metaKey: true, altKey: true })).toBe(false)
  })

  it('⇧⌘J no abre', () => {
    expect(isNewTerminalShortcut({ key: 'J', metaKey: true, shiftKey: true })).toBe(false)
  })

  it('J sin modificador no abre', () => {
    expect(isNewTerminalShortcut({ key: 'j' })).toBe(false)
  })

  it('⌘K no abre', () => {
    expect(isNewTerminalShortcut({ key: 'k', metaKey: true })).toBe(false)
  })

  it('code KeyJ con metaKey y sin key abre', () => {
    expect(isNewTerminalShortcut({ key: '', code: 'KeyJ', metaKey: true })).toBe(true)
  })
})
