/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PulseSnapshot } from '@shared/pulseEvents'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

import { PulseView } from '../PulseView'

const WORKSPACE_ID = 'dbbda641-1971-40bf-b139-bfb90a9205c6'
const TAG = `rodrigoanti/${WORKSPACE_ID}`

const snapshot: PulseSnapshot = {
  totalPrompts: 0,
  totalCommits: 0,
  totalTokens: 0,
  todayPrompts: 0,
  todayCommits: 0,
  currentStreak: 0,
  longestStreak: 0,
  avgPrompts30d: 0,
  days: [],
  agents: [],
  providers: [],
  scopes: {
    workspaces: [TAG],
    repos: [],
    hasPersonal: false,
  },
}

/** jsdom no implementa Popover API: el Select real la usa para abrir el listbox. */
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
    togglePopover: () => boolean
  }

  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }

  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
  proto.togglePopover = function togglePopover(this: HTMLElement) {
    if (this.hasAttribute('data-open')) {
      this.hidePopover()
      return false
    }
    this.showPopover()
    return true
  }
})

afterEach(cleanup)

describe('PulseView workspace labels', () => {
  const pulseSnapshot = vi.fn()
  const getConfig = vi.fn()

  beforeEach(() => {
    pulseSnapshot.mockReset()
    getConfig.mockReset()
    pulseSnapshot.mockResolvedValue(snapshot)
    getConfig.mockResolvedValue({
      orgWorkspaceCatalogCache: {
        byAccount: {
          '': {
            login: 'carlos',
            fetchedAt: 1,
            entries: [{
              slug: 'rodrigoanti',
              orgName: 'Rodrigoanti',
              workspaceId: WORKSPACE_ID,
              name: 'Covenant',
            }],
          },
        },
      },
    })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      pulseSnapshot,
      getConfig,
    }
  })

  it('no monta nada con open=false', () => {
    const { container } = render(<PulseView open={false} active onClose={() => undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('Escape dispara onClose', async () => {
    const onClose = vi.fn()
    render(<PulseView open active onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'pulse.title' })).toBeTruthy()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('muestra el nombre del workspace y filtra con el tag completo', async () => {
    render(<PulseView open active onClose={() => undefined} />)

    await waitFor(() => {
      expect(screen.getByText('rodrigoanti/Covenant')).toBeTruthy()
    })
    expect(screen.queryByText(TAG)).toBeNull()

    const trigger = screen.getByRole('button', { name: 'pulse.scope_workspace' })
    const panel = trigger.nextElementSibling as HTMLElement
    act(() => {
      panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
      panel.showPopover()
    })
    fireEvent.click(screen.getByText('rodrigoanti/Covenant'))

    await waitFor(() => {
      expect(pulseSnapshot).toHaveBeenCalledWith(expect.objectContaining({ workspace: TAG }))
    })
  })
})
