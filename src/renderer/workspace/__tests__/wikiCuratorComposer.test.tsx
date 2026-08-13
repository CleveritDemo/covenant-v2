/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WikiCuratorComposer } from '../WikiCuratorComposer'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

/** jsdom no implementa Popover API: polyfill mínimo + evento `toggle`. */
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
    togglePopover: () => boolean
  }

  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }

  proto.showPopover = function showPopover() {
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover() {
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
  proto.togglePopover = function togglePopover() {
    if (this.hasAttribute('data-open')) {
      this.hidePopover()
      return false
    }
    this.showPopover()
    return true
  }
})

const startWikiCuratorTurn = vi.fn()
const stopWikiCuratorTurn = vi.fn()
const onWikiCuratorEvent = vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined)
const getWikiCuratorConfig = vi.fn()
const setWikiCuratorConfig = vi.fn()
const listAgentCliModels = vi.fn()

beforeEach(() => {
  startWikiCuratorTurn.mockReset()
  stopWikiCuratorTurn.mockReset()
  onWikiCuratorEvent.mockReset()
  onWikiCuratorEvent.mockImplementation(() => () => undefined)
  getWikiCuratorConfig.mockReset()
  getWikiCuratorConfig.mockResolvedValue({ ok: true as const, config: {} })
  setWikiCuratorConfig.mockReset()
  setWikiCuratorConfig.mockResolvedValue({ ok: true as const, config: {} })
  listAgentCliModels.mockReset()
  listAgentCliModels.mockImplementation(async (provider: string) => {
    if (provider === 'cursor') {
      return { models: [{ id: 'auto', label: 'Auto' }, { id: 'composer-2.5', label: 'Composer 2.5' }], source: 'fallback' as const }
    }
    if (provider === 'claude') {
      return { models: [{ id: 'sonnet', label: 'Sonnet' }, { id: 'opus', label: 'Opus' }], source: 'fallback' as const }
    }
    return { models: [], source: 'fallback' as const }
  })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    onWikiCuratorEvent,
    startWikiCuratorTurn,
    stopWikiCuratorTurn,
    getWikiCuratorConfig,
    setWikiCuratorConfig,
    listAgentCliModels,
  }
})

afterEach(cleanup)

function openConfigPanel(): void {
  fireEvent.click(screen.getByLabelText('tabs.wikiCuratorConfigOpen'))
}

function pickSelectOption(ariaLabel: string, optionLabel: string): void {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const panel = trigger.parentElement?.querySelector('[popover]') as HTMLElement | null
  expect(panel).toBeTruthy()
  act(() => {
    panel!.showPopover()
  })
  const option = screen.getByRole('option', { name: optionLabel, hidden: true })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe('WikiCuratorComposer reutiliza el shell del composer', () => {
  it('monta PlaneChatComposerShell y no muestra badges/listbox de agentes', () => {
    render(
      <WikiCuratorComposer
        cwd="/tmp/proyecto"
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-plane-composer-shell]')).toBeTruthy()
    expect(document.querySelector('.plane-chat-composer--embedded')).toBeTruthy()
    expect(document.querySelector('.plane-chat-composer__agents')).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByLabelText('tabs.wikiCuratorInputLabel')).toBeTruthy()
    // Vacío → mic push-to-talk (misma fila que el composer del plano).
    expect(screen.getByLabelText('agentPane.dictationHold')).toBeTruthy()
    expect(screen.getByLabelText('sketch.open')).toBeTruthy()
    expect(screen.queryByText('empty')).toBeNull()
  })

  it('Enter envía vía startWikiCuratorTurn y stop usa stopWikiCuratorTurn', async () => {
    render(
      <WikiCuratorComposer
        cwd="/tmp/proyecto"
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'curar arquitectura' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(startWikiCuratorTurn).toHaveBeenCalledWith({
        cwd: '/tmp/proyecto',
        message: 'curar arquitectura',
      })
    })

    fireEvent.click(screen.getByLabelText('tabs.wikiCuratorStop'))
    expect(stopWikiCuratorTurn).toHaveBeenCalledWith('/tmp/proyecto')
  })

  it('Escape con foco en el input hace blur (no deja el foco en el composer)', () => {
    render(
      <WikiCuratorComposer
        cwd="/tmp/proyecto"
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const group = screen.getByRole('group', { name: 'tabs.wikiCuratorName' })
    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel') as HTMLTextAreaElement
    input.focus()
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(group, { key: 'Escape' })
    expect(document.activeElement).not.toBe(input)
  })

  it('al cambiar CLI persiste provider y recarga modelos de ese provider', async () => {
    render(
      <WikiCuratorComposer
        cwd="/tmp/proyecto"
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    openConfigPanel()
    await waitFor(() => {
      expect(getWikiCuratorConfig).toHaveBeenCalledWith('/tmp/proyecto')
      expect(listAgentCliModels).toHaveBeenCalledWith('claude')
    })

    pickSelectOption('tabs.wikiCuratorConfigProviderLabel', 'Cursor Agent')

    await waitFor(() => {
      expect(setWikiCuratorConfig).toHaveBeenCalledWith(
        '/tmp/proyecto',
        expect.objectContaining({ provider: 'cursor' }),
      )
      expect(listAgentCliModels).toHaveBeenCalledWith('cursor')
    })

    const modelTrigger = screen.getByRole('button', { name: 'tabs.wikiCuratorConfigModelLabel' })
    fireEvent.click(modelTrigger)
    const modelPanel = modelTrigger.parentElement?.querySelector('[popover]') as HTMLElement
    act(() => {
      modelPanel.showPopover()
    })
    expect(screen.getByRole('option', { name: /Composer 2\.5/, hidden: true })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'tabs.wikiCuratorConfigModelDefault', hidden: true })).toBeTruthy()
  })
})
