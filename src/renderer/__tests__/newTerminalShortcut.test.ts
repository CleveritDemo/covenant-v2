/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  isNewTerminalShortcut,
  isNewTerminalShortcutTargetAllowed,
  pickTerminalPaneId,
} from '../newTerminalShortcut'

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

describe('isNewTerminalShortcutTargetAllowed', () => {
  it('textarea dentro de .plane-chat-composer permite', () => {
    const composer = document.createElement('div')
    composer.className = 'plane-chat-composer'
    const textarea = document.createElement('textarea')
    composer.appendChild(textarea)
    document.body.appendChild(composer)
    expect(isNewTerminalShortcutTargetAllowed(textarea)).toBe(true)
    composer.remove()
  })

  it('textarea dentro de .agent-pane__composer permite', () => {
    const composer = document.createElement('div')
    composer.className = 'agent-pane__composer'
    const textarea = document.createElement('textarea')
    composer.appendChild(textarea)
    document.body.appendChild(composer)
    expect(isNewTerminalShortcutTargetAllowed(textarea)).toBe(true)
    composer.remove()
  })

  it('textarea suelto no permite', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    expect(isNewTerminalShortcutTargetAllowed(textarea)).toBe(false)
    textarea.remove()
  })

  it('input de un modal no permite', () => {
    const modal = document.createElement('div')
    modal.className = 'terminal-modal'
    const input = document.createElement('input')
    modal.appendChild(input)
    document.body.appendChild(modal)
    expect(isNewTerminalShortcutTargetAllowed(input)).toBe(false)
    modal.remove()
  })

  it('nodo dentro de .xterm no permite', () => {
    const xterm = document.createElement('div')
    xterm.className = 'xterm'
    const inner = document.createElement('div')
    xterm.appendChild(inner)
    document.body.appendChild(xterm)
    expect(isNewTerminalShortcutTargetAllowed(inner)).toBe(false)
    xterm.remove()
  })

  it('div normal permite', () => {
    const div = document.createElement('div')
    expect(isNewTerminalShortcutTargetAllowed(div)).toBe(true)
  })
})

describe('pickTerminalPaneId', () => {
  it('elige la última no-agente con mezcla de panes', () => {
    const paneIds = ['agent-1', 'term-1', 'agent-2', 'term-2']
    const paneKinds = { 'agent-1': 'agent', 'term-1': 'terminal', 'agent-2': 'agent', 'term-2': 'terminal' }
    expect(pickTerminalPaneId(paneIds, paneKinds)).toBe('term-2')
  })

  it('devuelve null si todas son agente', () => {
    const paneIds = ['agent-1', 'agent-2']
    const paneKinds = { 'agent-1': 'agent', 'agent-2': 'agent' }
    expect(pickTerminalPaneId(paneIds, paneKinds)).toBeNull()
  })

  it('devuelve null con lista vacía', () => {
    expect(pickTerminalPaneId([], {})).toBeNull()
  })
})
