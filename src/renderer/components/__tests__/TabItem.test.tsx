/**
 * @vitest-environment jsdom
 */
import React, { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TabSession } from '@shared/tabSession'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { TabItem } from '../TabItem'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Los timers son falsos: hover + avanzar el reloj dentro de act(). */
function hover(el: HTMLElement, ms: number): void {
  fireEvent.mouseEnter(el)
  act(() => { vi.advanceTimersByTime(ms) })
}

const tab: TabSession = {
  id: 't1',
  title: 'Workspace',
  paneIds: ['p1'],
  activePaneId: 'p1',
}

describe('TabItem', () => {
  it('muestra el tooltip del kit al hacer hover en cerrar pestaña', () => {
    const skipBlurCommitRef = { current: false }
    render(
      <TabItem
        tab={tab}
        tabNumber={1}
        isActive={false}
        isDragOver={false}
        dragOverPlace={null}
        isBusy={false}
        isEditing={false}
        editDraft=""
        editInputRef={createRef<HTMLInputElement>()}
        onSelect={() => {}}
        onStartEdit={() => {}}
        onEditDraftChange={() => {}}
        onEditCommit={() => {}}
        onEditCancel={() => {}}
        onClose={() => {}}
        onDragStart={() => {}}
        onDragOver={() => {}}
        onDrop={() => {}}
        onDragEnd={() => {}}
        onDragLeave={() => {}}
        skipBlurCommitRef={skipBlurCommitRef}
      />,
    )

    hover(screen.getByRole('button', { name: 'tabs.closeTabTitle' }), 400)
    expect(screen.getByRole('tooltip').textContent).toBe('tabs.closeTabTitle')
  })
})
