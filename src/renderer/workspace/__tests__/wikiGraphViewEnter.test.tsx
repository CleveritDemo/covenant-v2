/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { WikiGraphView } from '../WikiGraphView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../useWikiGraphScene', () => {
  const { useEffect } = require('react') as typeof import('react')
  return {
    useWikiGraphScene: (
      containerRef: { current: HTMLDivElement | null },
      _data: unknown,
      _cb: unknown,
      active = true,
    ) => {
      useEffect(() => {
        const el = containerRef.current
        if (!el || !active) return
        const canvas = document.createElement('canvas')
        el.appendChild(canvas)
        return () => {
          canvas.remove()
        }
      }, [containerRef, active])
      return { webglAvailable: false }
    },
  }
})

const baseProps = {
  data: { nodes: [], edges: [] },
  cwd: '/tmp/wiki',
  onClose: vi.fn(),
  onOpenNode: vi.fn(),
  onRefetchGraph: vi.fn(),
}

describe('WikiGraphView map implode enter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute('data-reduce-motion')
    baseProps.onClose.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-reduce-motion')
    cleanup()
  })

  it('al abrir aplica entering al canvas y oculta la barra hasta 2400ms', () => {
    render(<WikiGraphView {...baseProps} active />)

    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeTruthy()
    expect(document.querySelector('.wiki-graph-view__enter-hero')).toBeNull()
    expect(document.querySelector('.wiki-graph-view__bar')).toBeNull()
    expect(screen.getByRole('region', { name: 'tabs.wikiMapTitle' })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeNull()
    expect(document.querySelector('.wiki-graph-view__bar')).toBeTruthy()
  })

  it('con data-reduce-motion=true no aplica entering al canvas', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    render(<WikiGraphView {...baseProps} active />)

    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeNull()
    expect(document.querySelector('.wiki-graph-view__bar')).toBeTruthy()
  })

  it('Escape cierra el mapa durante la entrada', () => {
    render(<WikiGraphView {...baseProps} active />)

    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('al reactivar active vuelve a aplicar entering al canvas', () => {
    const { rerender } = render(<WikiGraphView {...baseProps} active={false} />)
    expect(screen.queryByRole('region', { name: 'tabs.wikiMapTitle' })).toBeNull()

    rerender(<WikiGraphView {...baseProps} active />)
    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeNull()

    rerender(<WikiGraphView {...baseProps} active={false} />)
    rerender(<WikiGraphView {...baseProps} active />)
    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeTruthy()
  })

  it('visible=false oculta el root, no cierra con Escape y no crea la escena', () => {
    const { rerender } = render(<WikiGraphView {...baseProps} active visible={false} />)
    const root = document.querySelector('.wiki-graph-view')
    expect(root).not.toBeNull()
    expect(root!.classList.contains('wiki-graph-view--hidden')).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(baseProps.onClose).not.toHaveBeenCalled()
    expect(document.querySelector('.wiki-graph-view__canvas canvas')).toBeNull()

    rerender(<WikiGraphView {...baseProps} active visible />)
    expect(document.querySelector('.wiki-graph-view--hidden')).toBeNull()
    expect(document.querySelector('.wiki-graph-view__canvas canvas')).not.toBeNull()
    expect(document.querySelector('.wiki-graph-view__canvas--entering')).toBeTruthy()
  })
})
