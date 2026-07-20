import React from 'react'
import './Input.css'

export type InputSize = 'sm' | 'md'
export type InputVariant = 'default' | 'inline'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  size?: InputSize
  variant?: InputVariant
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', variant = 'default', ...rest }, ref) => (
    <input
      ref={ref}
      className={['input', `input--${size}`, `input--${variant}`].filter(Boolean).join(' ')}
      {...rest}
    />
  ),
)
Input.displayName = 'Input'
