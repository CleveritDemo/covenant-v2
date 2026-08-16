import React, { useCallback, useState } from 'react'
import type { ClipboardEvent } from 'react'
import { useT } from '@i18n/useT'
import type { ComposerPastedText } from '@shared/composerPastedText'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
import { DictationListeningOverlay } from '../components/DictationListeningOverlay'
import { PendingImageThumb } from '../components/PendingImageThumb'
import { PastedTextAttachment } from '../components/PastedTextAttachment'
import { AgentPaneSendButton } from './AgentPaneSendButton'

export interface AgentPanePendingImage {
  id: string
  previewUrl: string
  name: string
}

export interface AgentPaneFooterProps {
  pendingImages: AgentPanePendingImage[]
  pastedTexts?: ComposerPastedText[]
  composerDisabled: boolean
  busy: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  orchestratorBusy: boolean
  /** turbo: placeholder distinto mientras awaiting y no busy. */
  orchestrationWorkStyle?: 'linear' | 'turbo'
  input: string
  showStop: boolean
  composerInputRef: React.Ref<HTMLTextAreaElement>
  onInputChange: (value: string) => void
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /**
   * Recalcula la mención de Jira. Se llama al escribir y también al mover el
   * caret sin teclear (flechas, clic, Cmd+A): si no, salir de `GRAV-4` deja la
   * lista abierta sobre un token que el usuario ya abandonó.
   */
  onComposerCaret?: (element: HTMLTextAreaElement) => void
  /**
   * La lista de issues de Jira, ya posicionada. El footer solo la coloca: quién
   * la abre y qué pasa al elegir lo decide `AgentPane` con `useJiraMention`.
   */
  mentionPicker?: React.ReactNode
  onRemovePendingImage: (id: string) => void
  onRemovePastedText?: (id: string) => void
  onSendClick: () => void
  /** Envía texto dictado (mismo path que send). */
  onDictateSend: (text: string) => void
  /** Sonido de inicio de dictado; default true. */
  systemSoundsEnabled?: boolean
}

export const AgentPaneFooter: React.FC<AgentPaneFooterProps> = ({
  pendingImages,
  pastedTexts = [],
  composerDisabled,
  busy,
  awaitingDelegations,
  delegationWorkActive,
  orchestratorBusy,
  orchestrationWorkStyle = 'linear',
  input,
  showStop,
  composerInputRef,
  onInputChange,
  onComposerPaste,
  onComposerKeyDown,
  onComposerCaret,
  mentionPicker,
  onRemovePendingImage,
  onRemovePastedText,
  onSendClick,
  onDictateSend,
  systemSoundsEnabled = true,
}) => {
  const { t, i18n } = useT()
  const [dictationError, setDictationError] = useState('')
  const sendMode = showStop
    ? 'stop'
    : (!input.trim() && pendingImages.length === 0 && pastedTexts.length === 0 ? 'mic' : 'send')
  const sendLabel = showStop
    ? t('agentPane.stop')
    : sendMode === 'mic'
      ? t('agentPane.dictationHold')
      : t('agentPane.send')
  const turboAwaitingOpen = orchestrationWorkStyle === 'turbo'
    && awaitingDelegations
    && !busy
  const composerPlaceholder = turboAwaitingOpen
    ? t('agentPane.turboAwaitingPlaceholder')
    : busy || awaitingDelegations || delegationWorkActive || orchestratorBusy
      ? t('agentPane.queuePlaceholder')
      : t('agentPane.placeholder')

  const mapDictationError = useCallback((code: string): string => {
    const kind = classifyDictationError(code)
    if (kind === 'unsupported') return t('agentPane.dictationUnsupported')
    if (kind === 'helperMissing') return t('agentPane.dictationHelperMissing')
    if (kind === 'startFailed') return t('agentPane.dictationStartFailed')
    if (kind === 'permission') return t('agentPane.dictationPermissionDenied')
    if (kind === 'electronUnavailable') return t('agentPane.dictationUnavailableElectron')
    if (kind === 'noSpeech') return t('agentPane.dictationNoSpeech')
    if (kind === 'tooShort') return t('agentPane.dictationTooShort')
    if (kind === 'noAudio') return t('agentPane.dictationNoAudio')
    return t('agentPane.dictationError')
  }, [t])

  const speechLang = i18n.language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const { listening, interim, level, start: startDictation, stop: stopDictation } = usePushToTalkSpeech({
    lang: speechLang,
    systemSoundsEnabled,
    onTranscript: onDictateSend,
    onError: code => {
      setDictationError(mapDictationError(code))
      window.setTimeout(() => setDictationError(''), 5000)
    },
  })

  const micLabel = listening ? t('agentPane.dictationListening') : sendLabel

  return (
    <div className="agent-pane__footer agent-pane__footer--chat-only">
      <DictationListeningOverlay
        active={listening}
        level={level}
        text={interim.trim() || t('agentPane.dictationLive')}
      />
      {pastedTexts.length > 0 && (
        <div
          className="agent-pane__pastes"
          aria-label={t('agentPane.pastedTextAttached', { n: pastedTexts.length })}
        >
          {pastedTexts.map(paste => (
            <PastedTextAttachment
              key={paste.id}
              paste={paste}
              onRemove={onRemovePastedText ? () => onRemovePastedText(paste.id) : undefined}
            />
          ))}
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="agent-pane__attachments" aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}>
          {pendingImages.map(image => (
            <PendingImageThumb
              key={image.id}
              src={image.previewUrl}
              name={image.name}
              removeDisabled={composerDisabled}
              onRemove={() => onRemovePendingImage(image.id)}
            />
          ))}
        </div>
      )}

      <div className="agent-pane__composer">
        <textarea
          ref={composerInputRef}
          value={input}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          rows={1}
          onChange={event => {
            onInputChange(event.target.value)
            onComposerCaret?.(event.target)
          }}
          onSelect={event => onComposerCaret?.(event.currentTarget)}
          onPaste={onComposerPaste}
          onKeyDown={onComposerKeyDown}
          onMouseDown={event => event.stopPropagation()}
        />
        {mentionPicker}
        <AgentPaneSendButton
          mode={sendMode}
          label={sendMode === 'mic' ? micLabel : sendLabel}
          listening={listening}
          disabled={composerDisabled && !showStop}
          onClick={onSendClick}
          onMicStart={startDictation}
          onMicStop={stopDictation}
        />
      </div>
      {!listening && dictationError ? (
        <p className="agent-pane__dictation-error" role="status">{dictationError}</p>
      ) : null}
    </div>
  )
}
