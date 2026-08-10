import React, { useCallback, useState } from 'react'
import type { ClipboardEvent } from 'react'
import { useT } from '@i18n/useT'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
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
  /** Envía texto dictado (mismo path que send). */
  onDictateSend: (text: string) => void
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
  onDictateSend,
}) => {
  const { t, i18n } = useT()
  const [dictationError, setDictationError] = useState('')
  const sendMode = showStop
    ? 'stop'
    : showPlay
      ? 'play'
      : (!input.trim() && pendingImages.length === 0 ? 'mic' : 'send')
  const sendLabel = showStop
    ? t('agentPane.stop')
    : showPlay
      ? t('agentPane.loopStart')
      : sendMode === 'mic'
        ? t('agentPane.dictationHold')
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

  const mapDictationError = useCallback((code: string): string => {
    const kind = classifyDictationError(code)
    if (kind === 'unsupported') return t('agentPane.dictationUnsupported')
    if (kind === 'permission') return t('agentPane.dictationPermissionDenied')
    if (kind === 'electronUnavailable') return t('agentPane.dictationUnavailableElectron')
    return t('agentPane.dictationError')
  }, [t])

  const speechLang = i18n.language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const { listening, start: startDictation, stop: stopDictation } = usePushToTalkSpeech({
    lang: speechLang,
    onTranscript: onDictateSend,
    onError: code => {
      setDictationError(mapDictationError(code))
      window.setTimeout(() => setDictationError(''), 4000)
    },
  })

  const micLabel = listening ? t('agentPane.dictationListening') : sendLabel

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
          label={sendMode === 'mic' ? micLabel : sendLabel}
          listening={listening}
          disabled={composerDisabled && !showStop && !showPlay}
          onClick={onSendClick}
          onMicStart={startDictation}
          onMicStop={stopDictation}
        />
      </div>
      {dictationError ? (
        <p className="agent-pane__dictation-error" role="status">{dictationError}</p>
      ) : null}
    </div>
  )
}
