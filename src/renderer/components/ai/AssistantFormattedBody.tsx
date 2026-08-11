import React, { useMemo } from 'react'
import { useT } from '@i18n/useT'
import { AiMarkdown } from '../AiMarkdown'
import { AiCodeBlock } from '../AiCodeBlock'
import { DelegationAssemblingPlaceholder } from './DelegationAssemblingPlaceholder'
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
  const { t } = useT()
  const segments = useMemo(
    () => splitAssistantBody(stripAgentControlFences(content, { keepDelegateFences: live })),
    [content, live],
  )
  if (segments.length === 0) return null
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          if (live && segment.lang === 'ia-terminal-delegate') {
            return (
              <DelegationAssemblingPlaceholder
                key={index}
                label={t('agentPane.assemblingDelegation')}
              />
            )
          }
          return (
            <AiCodeBlock
              key={index}
              lang={segment.lang}
              content={segment.content}
              isStreaming={live}
              isLastSegment={index === segments.length - 1}
              onInsert={() => undefined}
            />
          )
        }
        return (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={live && index === segments.length - 1}
          />
        )
      })}
    </>
  )
}
