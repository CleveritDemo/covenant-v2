import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import {
  formatPastedTextSize,
  pastedTextPreview,
  type ComposerPastedText,
} from '@shared/composerPastedText'
import { Icon } from './ui/Icon'
import { TerminalModal } from './TerminalModal'
import './PastedTextAttachment.css'

export interface PastedTextAttachmentProps {
  paste: ComposerPastedText
  onRemove?: () => void
}

/**
 * Tarjeta de texto pegado largo: adjunto al composer (con ×). Al clickearla
 * abre el contenido completo en un modal, igual que PendingImageThumb.
 */
export const PastedTextAttachment: React.FC<PastedTextAttachmentProps> = ({
  paste,
  onRemove,
}) => {
  const { t } = useT()
  const [preview, setPreview] = useState(false)
  const isReference = paste.kind === 'reference'
  const titleKey = isReference ? 'agentPane.referenceTitle' : 'agentPane.pastedTextTitle'
  const badgeKey = isReference ? 'agentPane.referenceBadge' : 'agentPane.pastedTextBadge'

  return (
    <>
      <span className="pasted-text">
        <button
          type="button"
          className="pasted-text__open"
          aria-label={t(titleKey)}
          onClick={() => setPreview(true)}
        >
          <span className="pasted-text__badge">{t(badgeKey)}</span>
          <span className="pasted-text__preview">{pastedTextPreview(paste.text)}</span>
        </button>
        {onRemove ? (
          <button
            type="button"
            className="pasted-text__remove"
            aria-label={t('agentPane.removePastedText')}
            onClick={onRemove}
          >
            <Icon name="close" size={10} />
          </button>
        ) : null}
      </span>

      <TerminalModal
        open={preview}
        onClose={() => setPreview(false)}
        title={t(titleKey)}
        size="xl"
        zIndex={700}
        closeOnBackdrop
      >
        <div className="pasted-text__modal">
          <p className="pasted-text__meta">
            {formatPastedTextSize(paste.byteSize)}
            {' • '}
            {t('agentPane.pastedTextLines', { n: paste.lineCount })}
            {' • '}
            {t('agentPane.pastedTextFormatHint')}
          </p>
          <pre className="pasted-text__body">{paste.text}</pre>
        </div>
      </TerminalModal>
    </>
  )
}
