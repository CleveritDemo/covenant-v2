import React, { useMemo, useState } from 'react'
import { buildAiCodeHighlightPieces } from './aiCodeHighlight'
import { isShellAiCodeLang, normalizeAiCodeLang } from './aiCodeLang'
import './AiMarkdown.css'

interface AiCodeBlockProps {
  lang: string
  content: string
  isStreaming: boolean
  isLastSegment: boolean
  onInsert: (cmd: string) => void
}

function displayLangLabel(lang: string): string {
  const normalized = normalizeAiCodeLang(lang)
  return normalized || 'text'
}

export const AiCodeBlock: React.FC<AiCodeBlockProps> = ({
  lang,
  content,
  isStreaming,
  isLastSegment,
  onInsert,
}) => {
  const [copied, setCopied] = useState(false)
  const pieces = useMemo(
    () => buildAiCodeHighlightPieces(content, lang),
    [content, lang],
  )

  function handleCopy(): void {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="ai-code-block">
      <div className="ai-code-chrome" aria-hidden="true">
        <span className="ai-code-lang">{displayLangLabel(lang)}</span>
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
        <code className="ai-code-pre__code">
          {pieces.map((piece, index) => (
            piece.className
              ? (
                  <span key={index} className={piece.className}>
                    {piece.text}
                  </span>
                )
              : (
                  <React.Fragment key={index}>{piece.text}</React.Fragment>
                )
          ))}
        </code>
        {isStreaming && isLastSegment ? <span className="ai-cursor">▌</span> : null}
      </pre>
      {!isStreaming && isShellAiCodeLang(lang) ? (
        <button
          type="button"
          className="ai-insert-btn"
          aria-label="Ctrl+U + pegar en terminal (sin Enter)"
          onClick={() => onInsert(content)}
        >
          ↵ poner en terminal
        </button>
      ) : null}
    </div>
  )
}
