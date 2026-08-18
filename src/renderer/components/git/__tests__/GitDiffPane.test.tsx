/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { GitDiffPane } from '../GitDiffPane'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(cleanup)

describe('GitDiffPane empty states', () => {
  it('does not call gitDiffFile for an untracked folder and shows that empty state', async () => {
    const gitDiffFile = vi.fn()
    ;(window as unknown as { api: { gitDiffFile: typeof gitDiffFile } }).api = { gitDiffFile }
    render(
      <GitDiffPane
        target={{ path: '/tmp/repo' }}
        selection={{ path: '.gravity/', area: 'untracked' }}
        refreshToken={1}
      />,
    )
    expect(await screen.findByText('git.diffUntrackedFolderTitle')).toBeTruthy()
    expect(screen.getByText('git.diffUntrackedFolderHint')).toBeTruthy()
    await waitFor(() => {
      expect(gitDiffFile).not.toHaveBeenCalled()
    })
  })

  it('does not render git stderr when gitDiffFile fails', async () => {
    const stderr = "error: Could not access '.gravity/null'"
    const gitDiffFile = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr,
    })
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    ;(window as unknown as { api: { gitDiffFile: typeof gitDiffFile } }).api = { gitDiffFile }
    render(
      <GitDiffPane
        target={{ path: '/tmp/repo' }}
        selection={{ path: 'src/a.ts', area: 'worktree' }}
        refreshToken={1}
      />,
    )
    expect(await screen.findByText('git.diffErrorTitle')).toBeTruthy()
    expect(screen.getByText('git.diffErrorHint')).toBeTruthy()
    expect(screen.queryByText(stderr)).toBeNull()
    await waitFor(() => {
      expect(gitDiffFile).toHaveBeenCalledTimes(1)
    })
    debug.mockRestore()
  })
})
