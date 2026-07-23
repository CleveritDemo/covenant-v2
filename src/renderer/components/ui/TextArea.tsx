import React, { forwardRef } from 'react'
import './TextArea.css'

export type TextAreaSize = 'sm' | 'md'
export type TextAreaVariant = 'default'

export interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  size?: TextAreaSize
  variant?: TextAreaVariant
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { size = 'md', variant = 'default', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`textarea textarea--${size} textarea--${variant}`}
      {...rest}
    />
  )
})
