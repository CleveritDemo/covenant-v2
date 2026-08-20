import React from 'react'
import { TextArea } from '../components/ui'
import './TabContextMarkdownField.css'

export interface TabContextMarkdownFieldProps {
  label: string
  hint?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

export const TabContextMarkdownField: React.FC<TabContextMarkdownFieldProps> = ({
  label,
  hint,
  placeholder,
  value,
  onChange,
}) => {
  return (
    <div className="tab-context-markdown-field">
      <span className="tab-context-markdown-field__label">
        {label}
        {hint ? <small className="tab-context-markdown-field__hint">{hint}</small> : null}
      </span>
      <TextArea
        rows={18}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  )
}
