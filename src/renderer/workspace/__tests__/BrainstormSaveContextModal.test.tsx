/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => (open ? <div>{children}</div> : null),
}))

vi.mock('../../agent/TabContextAppearancePopup', () => ({
  TabContextAppearancePopup: () => null,
}))

import { BrainstormSaveContextModal } from '../BrainstormSaveContextModal'

describe('BrainstormSaveContextModal path', () => {
  afterEach(cleanup)

  it('shows the canonical .gravity/context/<stem>.md destination', () => {
    render(
      <BrainstormSaveContextModal
        open
        defaultName="mi-acta"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(screen.getByText(/\.gravity\/context\/mi-acta\.md/)).toBeTruthy()
  })
})
