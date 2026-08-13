/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { wikiCuratorHistoryStorageKey } from '@shared/wikiCuratorHistory'
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
let wikiCuratorEventHandler: ((event: unknown) => void) | undefined
const onWikiCuratorEvent = vi.fn((_cwd: string, cb: (event: unknown) => void) => {
  wikiCuratorEventHandler = cb
  return () => {
    wikiCuratorEventHandler = undefined
  }
})
const getWikiCuratorConfig = vi.fn()
const setWikiCuratorConfig = vi.fn()
const listAgentCliModels = vi.fn()

const CWD = '/tmp/proyecto'
const HISTORY_KEY = wikiCuratorHistoryStorageKey(CWD)

beforeEach(() => {
  localStorage.clear()
  wikiCuratorEventHandler = undefined
  startWikiCuratorTurn.mockReset()
  stopWikiCuratorTurn.mockReset()
  onWikiCuratorEvent.mockReset()
  onWikiCuratorEvent.mockImplementation((_cwd, cb) => {
    wikiCuratorEventHandler = cb
    return () => {
      wikiCuratorEventHandler = undefined
    }
  })
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

function emitWikiCuratorEvent(event: unknown): void {
  act(() => {
    wikiCuratorEventHandler?.(event)
  })
}

describe('WikiCuratorComposer reutiliza el shell del composer', () => {
  it('monta PlaneChatComposerShell y no muestra badges/listbox de agentes', () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-plane-composer-shell]')).toBeTruthy()
    expect(document.querySelector('.plane-chat-composer--embedded')).toBeTruthy()
    expect(document.querySelector('.plane-chat-composer__agents')).toBeNull()
    expect(document.querySelector('.wiki-curator-composer__quick-config')).toBeTruthy()
    expect(screen.getByLabelText('tabs.wikiCuratorInputLabel')).toBeTruthy()
    // Vacío → mic push-to-talk (misma fila que el composer del plano).
    expect(screen.getByLabelText('agentPane.dictationHold')).toBeTruthy()
    expect(screen.getByLabelText('sketch.open')).toBeTruthy()
    expect(screen.queryByText('empty')).toBeNull()
  })

  it('Enter envía vía startWikiCuratorTurn y stop usa stopWikiCuratorTurn', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'curar arquitectura' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(startWikiCuratorTurn).toHaveBeenCalledWith({
        cwd: CWD,
        message: 'curar arquitectura',
      })
    })

    fireEvent.click(screen.getByLabelText('tabs.wikiCuratorStop'))
    expect(stopWikiCuratorTurn).toHaveBeenCalledWith(CWD)
  })

  it('Escape con foco en el input hace blur (no deja el foco en el composer)', () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
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

  it('muestra selects de CLI y modelo sin abrir el popover y persiste config', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(getWikiCuratorConfig).toHaveBeenCalledWith(CWD)
      expect(listAgentCliModels).toHaveBeenCalledWith('claude')
    })

    expect(screen.getByRole('button', { name: 'tabs.wikiCuratorConfigProviderLabel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabs.wikiCuratorConfigModelLabel' })).toBeTruthy()

    pickSelectOption('tabs.wikiCuratorConfigProviderLabel', 'Cursor Agent')

    await waitFor(() => {
      expect(setWikiCuratorConfig).toHaveBeenCalledWith(
        CWD,
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

  it('el popover de config solo muestra nombre y reglas', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    openConfigPanel()

    await waitFor(() => {
      expect(screen.getByText('tabs.wikiCuratorConfigNameLabel')).toBeTruthy()
      expect(screen.getByText('tabs.wikiCuratorConfigRulesLabel')).toBeTruthy()
    })

    const dialog = screen.getByRole('dialog', { name: 'tabs.wikiCuratorConfigTitle' })
    expect(dialog.querySelectorAll('[popover]')).toHaveLength(0)
  })

  it('persiste historial entre remounts vía localStorage', async () => {
    const { unmount } = render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'hola curador' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(localStorage.getItem(HISTORY_KEY)).toContain('hola curador')
    })

    unmount()

    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    expect(screen.getByText('hola curador')).toBeTruthy()
  })

  it('agrega entrada user y curator tras un turno simulado', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'revisar índice' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('revisar índice')).toBeTruthy()
    })

    emitWikiCuratorEvent({ type: 'delta', text: 'Revisando ' })
    expect(screen.getByText('Revisando')).toBeTruthy()

    emitWikiCuratorEvent({ type: 'final', text: 'Revisando el índice wiki.' })
    emitWikiCuratorEvent({ type: 'done' })

    await waitFor(() => {
      expect(screen.getByText('Revisando el índice wiki.')).toBeTruthy()
      expect(screen.queryByText('Revisando')).toBeNull()
    })
  })

  it('error seguido de done deja una sola representación visible del error', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'fallar cli' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('fallar cli')).toBeTruthy()
    })

    const errorMessage = 'CLI no disponible'
    emitWikiCuratorEvent({ type: 'error', message: errorMessage })
    expect(screen.getAllByText(errorMessage)).toHaveLength(2)
    expect(document.querySelector('.wiki-curator-composer__live')).toBeTruthy()

    emitWikiCuratorEvent({ type: 'done' })

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy()
      expect(document.querySelector('.wiki-curator-composer__live')).toBeNull()
    })
    expect(screen.getAllByText(errorMessage)).toHaveLength(1)
  })

  it('clear tras error y done elimina todo lo visible y la key de localStorage', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'otro fallo' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('otro fallo')).toBeTruthy()
    })

    const errorMessage = 'timeout del agente'
    emitWikiCuratorEvent({ type: 'error', message: errorMessage })
    emitWikiCuratorEvent({ type: 'done' })

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy()
      expect(document.querySelector('.wiki-curator-composer__live')).toBeNull()
    })

    fireEvent.click(screen.getByLabelText('tabs.wikiCuratorHistoryClear'))

    await waitFor(() => {
      expect(screen.queryByText('otro fallo')).toBeNull()
      expect(screen.queryByText(errorMessage)).toBeNull()
      expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
    })
  })

  it('clear borra historial y la key de localStorage', async () => {
    render(
      <WikiCuratorComposer
        cwd={CWD}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('tabs.wikiCuratorInputLabel')
    fireEvent.change(input, { target: { value: 'mensaje previo' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('mensaje previo')).toBeTruthy()
      expect(localStorage.getItem(HISTORY_KEY)).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('tabs.wikiCuratorHistoryClear'))

    await waitFor(() => {
      expect(screen.queryByText('mensaje previo')).toBeNull()
      expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
    })
  })
})
