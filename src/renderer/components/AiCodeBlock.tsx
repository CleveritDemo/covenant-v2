import React, { useState } from 'react'
import './AiMarkdown.css'

const SHELL_LANGS = new Set([
  'bash', 'sh', 'zsh', 'shell', 'console', 'terminal', 'fish', 'ksh', 'csh',
])

function isShellLang(lang: string): boolean {
  return SHELL_LANGS.has(lang.trim().toLowerCase())
}

interface AiCodeBlockProps {
  lang: string
  content: string
  isStreaming: boolean
  isLastSegment: boolean
  onInsert: (cmd: string) => void
}

export const AiCodeBlock: React.FC<AiCodeBlockProps> = ({
  lang,
  content,
  isStreaming,
  isLastSegment,
  onInsert,
}) => {
  const [copied, setCopied] = useState(false)

  function handleCopy(): void {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="ai-code-block">
      <div className="ai-code-chrome" aria-hidden="true">
        <span className="ai-code-lang">{lang.trim() || 'text'}</span>
        {!isStreaming && (
          <button
            type="button"
            className="ai-copy-btn"
            aria-label="Copiar código"
            onClick={handleCopy}
          >
            {copied ? '✓' : '⧉'}
          </button>
        )}
      </div>
      <pre className="ai-code-pre">
        {content}
        {isStreaming && isLastSegment && <span className="ai-cursor">▌</span>}
      </pre>
      {!isStreaming && isShellLang(lang) && (
        <button
          type="button"
          className="ai-insert-btn"
          aria-label="Ctrl+U + pegar en terminal (sin Enter)"
          onClick={() => onInsert(content)}
        >
          ↵ poner en terminal
        </button>
      )}
    </div>
  )
}
