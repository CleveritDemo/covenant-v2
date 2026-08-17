/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { BrainstormOverlay } from '../BrainstormOverlay'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

afterEach(() => {
  cleanup()
})

describe('BrainstormOverlay aurora ribbon', () => {
  it('mounts the aurora idle without --working', () => {
    const { container } = render(
      <BrainstormOverlay busy={false} ariaLabel="x" closeLabel="y" onClose={() => {}}>
        <div />
      </BrainstormOverlay>,
    )
    const aurora = container.querySelector('.plane-composer-aurora')
    expect(aurora).not.toBeNull()
    expect(aurora!.classList.contains('plane-composer-aurora--working')).toBe(false)
  })

  it('adds --working when busy is true', () => {
    const { container } = render(
      <BrainstormOverlay busy ariaLabel="x" closeLabel="y" onClose={() => {}}>
        <div />
      </BrainstormOverlay>,
    )
    const aurora = container.querySelector('.plane-composer-aurora')
    expect(aurora).not.toBeNull()
    expect(aurora!.classList.contains('plane-composer-aurora--working')).toBe(true)
  })

  it('mounts the spherical grid inside the floor', () => {
    const { container } = render(
      <BrainstormOverlay busy={false} ariaLabel="x" closeLabel="y" onClose={() => {}}>
        <div />
      </BrainstormOverlay>,
    )
    const floor = container.querySelector('.brainstorm-overlay__floor')
    expect(floor).not.toBeNull()
    expect(floor!.querySelector('.plane-map__grid--spherical')).not.toBeNull()
  })
})
