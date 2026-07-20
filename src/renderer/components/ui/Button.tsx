import React from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize = 'xs' | 'sm' | 'md'

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Estado visual “activo / pulsado” (p. ej. icon toggle). */
  pressed?: boolean
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  pressed = false,
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      pressed ? 'btn--pressed' : '',
    ].filter(Boolean).join(' ')}
    aria-pressed={pressed || undefined}
    {...rest}
  >
    {children}
  </button>
)
