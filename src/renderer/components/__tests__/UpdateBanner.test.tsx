/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { UpdateBanner } from '../UpdateBanner'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      if (key === 'update.errorOffline') return "Updates paused — you're offline"
      if (key === 'update.errorFailed') return "Couldn't check for updates"
      return key
    },
  }),
}))

const getUpdateState = vi.fn()
const onUpdateState = vi.fn()
const getAppVersion = vi.fn()
const installUpdate = vi.fn()
const dismissUpdate = vi.fn()

beforeEach(() => {
  getUpdateState.mockReset()
  getUpdateState.mockResolvedValue({ kind: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' })
  onUpdateState.mockReset()
  onUpdateState.mockReturnValue(() => {})
  getAppVersion.mockReset()
  getAppVersion.mockResolvedValue('0.0.0')
  installUpdate.mockReset()
  dismissUpdate.mockReset()
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      getUpdateState,
      onUpdateState,
      getAppVersion,
      installUpdate,
      dismissUpdate,
    },
  }))
})

afterEach(cleanup)

describe('UpdateBanner error chip', () => {
  it('pinta copy amable offline y oculta el error crudo de Chromium', async () => {
    const { container } = render(<UpdateBanner />)

    await waitFor(() => {
      expect(container.querySelector('.update-banner--offline')).toBeTruthy()
    })

    const chip = container.querySelector('.update-banner') as HTMLElement
    expect(chip.textContent).toContain("Updates paused — you're offline")
    expect(chip.textContent).not.toContain('net::ERR_INTERNET_DISCONNECTED')
    expect(container.querySelector('.update-banner--error')).toBeNull()
  })
})
