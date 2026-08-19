import React from 'react'
import './PersonAvatarStack.css'

export interface PersonAvatarStackProps {
  logins: readonly string[]
  max?: number
  size?: 'sm' | 'md'
  label?: string
}

const DEFAULT_MAX = 3

/** Pila de iniciales de personas: tope de 3, el resto como +N. */
export const PersonAvatarStack: React.FC<PersonAvatarStackProps> = ({
  logins,
  max = DEFAULT_MAX,
  size = 'md',
  label,
}) => {
  if (logins.length === 0) return null

  const shown = logins.slice(0, max)
  const extra = logins.length - shown.length

  return (
    <span
      className={`person-avatar-stack person-avatar-stack--${size}`}
      aria-label={label ?? logins.join(', ')}
    >
      {shown.map((login, index) => (
        <span key={`${login}-${index}`} className="person-avatar-stack__face" aria-hidden>
          {login.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {extra > 0 ? (
        <span className="person-avatar-stack__face person-avatar-stack__face--more" aria-hidden>
          +{extra}
        </span>
      ) : null}
    </span>
  )
}
