import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'
import { TerminalModal } from './TerminalModal'
import './PendingImageThumb.css'

export interface PendingImageThumbProps {
  src: string
  name: string
  removeDisabled?: boolean
  /** Sin esto la miniatura es solo de lectura: los adjuntos ya enviados. */
  onRemove?: () => void
}

/**
 * Miniatura de imagen: adjunta al composer (con ×) o ya enviada en un mensaje
 * (sin ×). En los dos casos se abre en grande al clickearla.
 *
 * La pastilla del hilo es 36px; el modal usa el mismo `src` (preview ~1280px
 * en mensajes enviados, blob URL completo en pendientes del composer).
 */
export const PendingImageThumb: React.FC<PendingImageThumbProps> = ({
  src,
  name,
  removeDisabled = false,
  onRemove,
}) => {
  const { t } = useT()
  const [preview, setPreview] = useState(false)

  return (
    <>
      <span className="pending-thumb">
        <button
          type="button"
          className="pending-thumb__open"
          aria-label={t('agentPane.imagePreviewOpen', { name })}
          onClick={() => setPreview(true)}
        >
          <img src={src} alt={name} />
        </button>
        {onRemove ? (
          <button
            type="button"
            className="pending-thumb__remove"
            aria-label={t('agentPane.removeImage')}
            disabled={removeDisabled}
            onClick={onRemove}
          >
            <Icon name="close" size={10} />
          </button>
        ) : null}
      </span>

      <TerminalModal
        open={preview}
        onClose={() => setPreview(false)}
        title={name}
        size="xl"
        bodyLayout="flush"
        zIndex={700}
        closeOnBackdrop
      >
        <div className="pending-thumb__preview">
          <img src={src} alt={name} decoding="async" />
        </div>
      </TerminalModal>
    </>
  )
}
