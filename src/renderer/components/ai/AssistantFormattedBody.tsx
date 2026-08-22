import React, { useMemo, useRef } from 'react'
import { useT } from '@i18n/useT'
import { findPreviewMentions } from '@shared/previewMentions'
import { PreviewMentionCard } from '../../agent/PreviewMentionCard'
import { AiMarkdown } from '../AiMarkdown'
import { AiCodeBlock } from '../AiCodeBlock'
import { ChatBubble } from './ChatBubble'
import { DelegationAssemblingPlaceholder } from './DelegationAssemblingPlaceholder'
import {
  findAssistantBodyLiveStart,
  splitAssistantBody,
  stripAgentControlFences,
  type AssistantBodySegment,
} from './assistantBodySegments'

export interface AssistantFormattedBodyProps {
  content: string
  live?: boolean
  onInsertCommand?: (cmd: string) => void
  onOpenPreview?: (fileName: string) => void
}

type BodyStableCache = {
  length: number
  slice: string
  segments: AssistantBodySegment[]
}

/** Render markdown/código tras strip de fences de control. */
export const AssistantFormattedBody: React.FC<AssistantFormattedBodyProps> = ({
  content,
  live = false,
  onInsertCommand,
  onOpenPreview,
}) => {
  const { t } = useT()
  const stableCacheRef = useRef<BodyStableCache>({ length: 0, slice: '', segments: [] })

  const mentions = useMemo(
    () => (onOpenPreview && !live ? findPreviewMentions(content) : []),
    [content, live, onOpenPreview],
  )

  const segments = useMemo(() => {
    const stripped = stripAgentControlFences(content, { keepDelegateFences: live })
    if (!live) return splitAssistantBody(stripped)

    const liveStart = findAssistantBodyLiveStart(stripped)
    const stableRaw = stripped.slice(0, liveStart)
    const liveRaw = stripped.slice(liveStart)

    let stableSegments: AssistantBodySegment[]
    if (
      stableCacheRef.current.length === stableRaw.length &&
      stableCacheRef.current.slice === stableRaw
    ) {
      stableSegments = stableCacheRef.current.segments
    } else {
      stableSegments = stableRaw ? splitAssistantBody(stableRaw) : []
      stableCacheRef.current = {
        length: stableRaw.length,
        slice: stableRaw,
        segments: stableSegments,
      }
    }

    const liveSegments = liveRaw ? splitAssistantBody(liveRaw) : []
    return [...stableSegments, ...liveSegments]
  }, [content, live])

  if (segments.length === 0 && mentions.length === 0) return null
  return (
    <>
      {segments.map((segment, index) => {
        const isLiveSegment = live && index === segments.length - 1
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
            <ChatBubble key={index} variant="assistant" solid>
              <AiCodeBlock
                lang={segment.lang}
                content={segment.content}
                isStreaming={live}
                isLastSegment={index === segments.length - 1}
                onInsert={onInsertCommand}
              />
            </ChatBubble>
          )
        }
        return (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={isLiveSegment}
            live={isLiveSegment}
          />
        )
      })}
      {mentions.length > 0 && onOpenPreview ? (
        <div className="assistant-formatted-body__preview-mentions">
          {mentions.map(mention => (
            <PreviewMentionCard
              key={mention.fileName}
              fileName={mention.fileName}
              label={t('previewMention.open')}
              onOpen={onOpenPreview}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
