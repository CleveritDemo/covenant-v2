import React, { useMemo } from 'react'
import { AiMarkdown } from '../AiMarkdown'
import { AiCodeBlock } from '../AiCodeBlock'
import { splitAssistantBody, stripAgentControlFences } from './assistantBodySegments'

export interface AssistantFormattedBodyProps {
  content: string
  live?: boolean
}

/** Render markdown/código tras strip de fences de control. */
export const AssistantFormattedBody: React.FC<AssistantFormattedBodyProps> = ({
  content,
  live = false,
}) => {
  const segments = useMemo(
    () => splitAssistantBody(stripAgentControlFences(content)),
    [content],
  )
  if (segments.length === 0) return null
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <AiCodeBlock
            key={index}
            lang={segment.lang}
            content={segment.content}
            isStreaming={live}
            isLastSegment={index === segments.length - 1}
            onInsert={() => undefined}
          />
        ) : (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={live && index === segments.length - 1}
          />
        ),
      )}
    </>
  )
}
