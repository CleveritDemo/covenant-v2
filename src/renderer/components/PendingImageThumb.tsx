import React, { useState } from 'react'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'
import { TerminalModal } from './TerminalModal'
import './PendingImageThumb.css'

export interface PendingImageThumbProps {
  src: string
  name: string
  removeDisabled?: boolean
  onRemove: () => void
}

/**
 * Miniatura de una imagen adjunta al composer, en el pane y en el plano.
 *
 * A 28px no se distingue una captura de otra, así que la miniatura abre la
 * imagen completa al clickearla. Y la × dejó de estar siempre encima: aparece
 * al pasar el mouse o al enfocar, que es cuando hace falta — antes tapaba
 * justo la esquina de lo que uno quería ver.
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
        <button
          type="button"
          className="pending-thumb__remove"
          aria-label={t('agentPane.removeImage')}
          disabled={removeDisabled}
          onClick={onRemove}
        >
          <Icon name="close" size={10} />
        </button>
      </span>

      <TerminalModal
        open={preview}
        onClose={() => setPreview(false)}
        title={name}
        size="lg"
        zIndex={700}
        closeOnBackdrop
      >
        <div className="pending-thumb__preview">
          <img src={src} alt={name} />
        </div>
      </TerminalModal>
    </>
  )
}
