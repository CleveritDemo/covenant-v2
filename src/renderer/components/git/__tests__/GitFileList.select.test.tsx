/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GitFileList } from '../GitFileList'
import type { GitDiffSelection } from '../GitDiffPane'
import { GitDiffPane } from '../GitDiffPane'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(cleanup)

describe('GitFileList selection', () => {
  it('calls onSelect when clicking a staged file name', () => {
    const onSelect = vi.fn()
    render(
      <GitFileList
        files={[{ path: 'src/a.ts', status: 'M ' }]}
        unstagedNumStat=""
        stagedNumStat={'src/a.ts\t1\t0'}
        idle
        onStageFile={() => {}}
        onUnstageFile={() => {}}
        onStageAll={() => {}}
        onUnstageAll={() => {}}
        selection={null}
        onSelect={onSelect}
        onDiscardFile={() => {}}
      />,
    )
    const nameButtons = screen.getAllByRole('button')
      .filter(btn => btn.classList.contains('git-file-list__name'))
    expect(nameButtons.length).toBeGreaterThan(0)
    fireEvent.click(nameButtons[0]!)
    expect(onSelect).toHaveBeenCalledWith({ path: 'src/a.ts', area: 'staged' })
  })

  it('keeps selection in parent state', () => {
    function Harness() {
      const [selection, setSelection] = useState<GitDiffSelection | null>(null)
      return (
        <>
          <GitFileList
            files={[{ path: 'src/a.ts', status: 'M ' }]}
            unstagedNumStat=""
            stagedNumStat={'src/a.ts\t1\t0'}
            idle
            onStageFile={() => {}}
            onUnstageFile={() => {}}
            onStageAll={() => {}}
            onUnstageAll={() => {}}
            selection={selection}
            onSelect={setSelection}
            onDiscardFile={() => {}}
          />
          <div data-testid="sel">{selection ? `${selection.area}:${selection.path}` : 'none'}</div>
        </>
      )
    }
    render(<Harness />)
    const nameButtons = screen.getAllByRole('button')
      .filter(btn => btn.classList.contains('git-file-list__name'))
    fireEvent.click(nameButtons[0]!)
    expect(screen.getByTestId('sel').textContent).toBe('staged:src/a.ts')
  })

  it('toggles selection off when clicking the selected file again', () => {
    const onSelect = vi.fn()
    render(
      <GitFileList
        files={[{ path: 'src/a.ts', status: 'M ' }]}
        unstagedNumStat=""
        stagedNumStat={'src/a.ts\t1\t0'}
        idle
        onStageFile={() => {}}
        onUnstageFile={() => {}}
        onStageAll={() => {}}
        onUnstageAll={() => {}}
        selection={{ path: 'src/a.ts', area: 'staged' }}
        onSelect={onSelect}
        onDiscardFile={() => {}}
      />,
    )
    const nameButtons = screen.getAllByRole('button')
      .filter(btn => btn.classList.contains('git-file-list__name'))
    fireEvent.click(nameButtons[0]!)
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

describe('GitDiffPane', () => {
  it('loads diff when selection is set without update-depth loops', async () => {
    const gitDiffFile = vi.fn().mockResolvedValue({
      ok: true,
      exitCode: 0,
      stdout: '@@ -1 +1 @@\n-a\n+b\n',
      stderr: '',
    })
    ;(window as unknown as { api: { gitDiffFile: typeof gitDiffFile } }).api = { gitDiffFile }
    render(
      <GitDiffPane
        target={{ path: '/tmp/repo' }}
        selection={{ path: 'src/a.ts', area: 'staged' }}
        refreshToken={1}
      />,
    )
    expect(await screen.findByText('b')).toBeTruthy()
    await waitFor(() => {
      expect(gitDiffFile.mock.calls.length).toBe(1)
    })
    expect(gitDiffFile).toHaveBeenCalledWith(
      { path: '/tmp/repo', sessionId: undefined },
      'src/a.ts',
      'staged',
    )
  })
})
