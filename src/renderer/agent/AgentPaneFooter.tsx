import React from 'react'
import type { ClipboardEvent } from 'react'
import { useT } from '@i18n/useT'
import { AgentPaneAttachmentRemove } from './AgentPaneAttachmentRemove'
import { AgentPaneSendButton } from './AgentPaneSendButton'

export interface AgentPanePendingImage {
  id: string
  previewUrl: string
  name: string
}

export interface AgentPaneFooterProps {
  pendingImages: AgentPanePendingImage[]
  composerDisabled: boolean
  loopMode: boolean
  busy: boolean
  loopActive: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  orchestratorBusy: boolean
  /** turbo: placeholder distinto mientras awaiting y no busy. */
  orchestrationWorkStyle?: 'linear' | 'turbo'
  input: string
  showStop: boolean
  showPlay: boolean
  composerInputRef: React.Ref<HTMLTextAreaElement>
  onInputChange: (value: string) => void
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onRemovePendingImage: (id: string) => void
  onSendClick: () => void
}

export const AgentPaneFooter: React.FC<AgentPaneFooterProps> = ({
  pendingImages,
  composerDisabled,
  loopMode,
  busy,
  loopActive,
  awaitingDelegations,
  delegationWorkActive,
  orchestratorBusy,
  orchestrationWorkStyle = 'linear',
  input,
  showStop,
  showPlay,
  composerInputRef,
  onInputChange,
  onComposerPaste,
  onComposerKeyDown,
  onRemovePendingImage,
  onSendClick,
}) => {
  const { t } = useT()
  const sendMode = showStop ? 'stop' : showPlay ? 'play' : 'send'
  const sendLabel = showStop
    ? t('agentPane.stop')
    : showPlay
      ? t('agentPane.loopStart')
      : t('agentPane.send')
  const turboAwaitingOpen = orchestrationWorkStyle === 'turbo'
    && awaitingDelegations
    && !busy
  const composerPlaceholder = loopActive || loopMode
    ? t('agentPane.loopPlaceholder')
    : turboAwaitingOpen
      ? t('agentPane.turboAwaitingPlaceholder')
      : busy || awaitingDelegations || delegationWorkActive || orchestratorBusy
        ? t('agentPane.queuePlaceholder')
        : t('agentPane.placeholder')

  return (
    <div className="agent-pane__footer agent-pane__footer--chat-only">
      {pendingImages.length > 0 && (
        <div className="agent-pane__attachments" aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}>
          {pendingImages.map(image => (
            <div key={image.id} className="agent-pane__attachment">
              <img src={image.previewUrl} alt={image.name} />
              <AgentPaneAttachmentRemove
                label={t('agentPane.removeImage')}
                disabled={composerDisabled}
                onClick={() => onRemovePendingImage(image.id)}
              />
            </div>
          ))}
        </div>
      )}

      <div className={['agent-pane__composer', loopMode ? 'agent-pane__composer--loop' : ''].filter(Boolean).join(' ')}>
        <textarea
          ref={composerInputRef}
          value={input}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          rows={1}
          onChange={event => onInputChange(event.target.value)}
          onPaste={onComposerPaste}
          onKeyDown={onComposerKeyDown}
          onMouseDown={event => event.stopPropagation()}
        />
        <AgentPaneSendButton
          mode={sendMode}
          label={sendLabel}
          disabled={composerDisabled && !showStop && !showPlay}
          onClick={onSendClick}
        />
      </div>
    </div>
  )
}
