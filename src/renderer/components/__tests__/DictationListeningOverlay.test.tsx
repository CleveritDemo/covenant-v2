/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DictationListeningOverlay } from '../DictationListeningOverlay'

afterEach(cleanup)

describe('DictationListeningOverlay', () => {
  it('renders nothing when inactive', () => {
    render(
      <DictationListeningOverlay active={false} level={0.5} text="hola" />,
    )
    expect(document.querySelector('.dictation-listening-overlay')).toBeNull()
  })

  it('shows scrim and streaming interim with caret when active with portal root', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    render(
      <DictationListeningOverlay
        active
        level={0.4}
        text="hola mundo"
        streaming
        scope="embedded"
        portalRoot={root}
      />,
    )
    expect(root.querySelector('.dictation-interim__word')?.textContent).toBe('hola')
    expect(root.querySelectorAll('.dictation-interim__word')[1]?.textContent).toBe('mundo')
    expect(root.querySelector('.dictation-listening-overlay__scrim')).toBeTruthy()
    expect(root.querySelector('.dictation-interim__caret')).toBeTruthy()
    expect(root.querySelector('.dictation-listening-overlay__canvas')).toBeNull()
    document.body.removeChild(root)
  })

  it('omits caret in waiting placeholder mode', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    render(
      <DictationListeningOverlay
        active
        text="Te escucho…"
        scope="chat-dock"
        portalRoot={root}
      />,
    )
    expect(root.querySelector('.dictation-interim--waiting')).toBeTruthy()
    expect(root.querySelector('.dictation-interim__caret')).toBeNull()
    document.body.removeChild(root)
  })

  it('uses chat-dock scope class', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    render(
      <DictationListeningOverlay
        active
        text="Te escucho…"
        scope="chat-dock"
        portalRoot={root}
      />,
    )
    expect(root.querySelector('.dictation-listening-overlay--chat-dock')).toBeTruthy()
    document.body.removeChild(root)
  })
})
