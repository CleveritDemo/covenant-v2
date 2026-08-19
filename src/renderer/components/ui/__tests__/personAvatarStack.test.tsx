/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PersonAvatarStack } from '../PersonAvatarStack'

afterEach(cleanup)

const five = ['ana', 'bruno', 'carla', 'diego', 'elena'] as const

describe('PersonAvatarStack', () => {
  it('con 5 logins pinta 3 círculos + +2', () => {
    const { container } = render(<PersonAvatarStack logins={five} />)
    const faces = container.querySelectorAll('.person-avatar-stack__face')
    expect(faces).toHaveLength(4)
    expect(faces[0]?.textContent).toBe('A')
    expect(faces[1]?.textContent).toBe('B')
    expect(faces[2]?.textContent).toBe('C')
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('con lista vacía no renderiza nada', () => {
    const { container } = render(<PersonAvatarStack logins={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('aria-label nombra todos los logins', () => {
    render(<PersonAvatarStack logins={five} />)
    expect(screen.getByLabelText(five.join(', '))).toBeTruthy()
  })
})
