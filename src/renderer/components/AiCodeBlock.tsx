import React, { useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import { Tooltip } from './ui/Tooltip'
import { buildAiCodeHighlightPieces } from './aiCodeHighlight'
import { isShellAiCodeLang, normalizeAiCodeLang } from './aiCodeLang'
import './AiMarkdown.css'

interface AiCodeBlockProps {
  lang: string
  content: string
  isStreaming: boolean
  isLastSegment: boolean
  onInsert?: (cmd: string) => void
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
  const { t } = useT()
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
            aria-label={t('aiCodeBlock.copyLabel')}
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
      {!isStreaming && onInsert && isShellAiCodeLang(lang) ? (
        <Tooltip
          content={t('aiCodeBlock.insertTooltip')}
          hint={t('aiCodeBlock.insertHint')}
        >
          <button
            type="button"
            className="ai-insert-btn"
            aria-label={t('aiCodeBlock.insertLabel')}
            onClick={() => onInsert(content)}
          >
            {t('aiCodeBlock.insertLabel')}
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
