import React, { useMemo } from 'react'
import './DictationInterimText.css'

export interface DictationInterimTextProps {
  text: string
  /** true = transcript parcial; false = placeholder «Te escucho…». */
  streaming?: boolean
}

function tokenizeInterim(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? (text ? [text] : [])
}

/** Interim del dictado con reveal por palabra, shimmer y caret de IA. */
export const DictationInterimText: React.FC<DictationInterimTextProps> = ({
  text,
  streaming = false,
}) => {
  const tokens = useMemo(() => tokenizeInterim(text), [text])

  return (
    <p
      className={[
        'dictation-interim',
        streaming ? 'dictation-interim--streaming' : 'dictation-interim--waiting',
      ].join(' ')}
    >
      <span className="dictation-interim__aura" aria-hidden="true" />
      <span className="dictation-interim__stream">
        {tokens.map((token, index) => {
          if (/^\s+$/.test(token)) {
            return (
              <span key={`space-${index}`} className="dictation-interim__space">
                {token}
              </span>
            )
          }
          return (
            <span
              key={`word-${index}-${token}`}
              className="dictation-interim__word"
              style={{ ['--word-i' as string]: String(index) }}
            >
              {token}
            </span>
          )
        })}
      </span>
      {streaming ? <span className="dictation-interim__caret" aria-hidden="true" /> : null}
    </p>
  )
}
