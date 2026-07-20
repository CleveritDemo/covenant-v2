import React from 'react'
import type { ClipboardEvent } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'

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

  return (
    <div className="agent-pane__footer agent-pane__footer--chat-only">
      {pendingImages.length > 0 && (
        <div className="agent-pane__attachments" aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}>
          {pendingImages.map(image => (
            <div key={image.id} className="agent-pane__attachment">
              <img src={image.previewUrl} alt={image.name} />
              <button
                type="button"
                className="agent-pane__attachment-remove"
                onClick={() => onRemovePendingImage(image.id)}
                disabled={composerDisabled}
                title={t('agentPane.removeImage')}
                aria-label={t('agentPane.removeImage')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={['agent-pane__composer', loopMode ? 'agent-pane__composer--loop' : ''].filter(Boolean).join(' ')}>
        <textarea
          ref={composerInputRef}
          value={input}
          disabled={composerDisabled}
          placeholder={
            loopActive ? t('agentPane.loopPlaceholder')
              : loopMode ? t('agentPane.loopPlaceholder')
              : busy ? t('agentPane.queuePlaceholder')
              : t('agentPane.placeholder')
          }
          rows={1}
          onChange={event => onInputChange(event.target.value)}
          onPaste={onComposerPaste}
          onKeyDown={onComposerKeyDown}
          onMouseDown={event => event.stopPropagation()}
        />
        <button
          type="button"
          className={[
            'agent-pane__send',
            showStop ? 'agent-pane__send--stop' : '',
            showPlay ? 'agent-pane__send--play' : '',
          ].filter(Boolean).join(' ')}
          disabled={composerDisabled && !showStop && !showPlay}
          title={showStop ? t('agentPane.stop') : showPlay ? t('agentPane.loopStart') : t('agentPane.send')}
          aria-label={showStop ? t('agentPane.stop') : showPlay ? t('agentPane.loopStart') : t('agentPane.send')}
          onClick={onSendClick}
          onMouseDown={event => event.stopPropagation()}
        >
          <Icon name={showStop ? 'stop' : showPlay ? 'play' : 'send'} size={14} />
        </button>
      </div>
    </div>
  )
}
