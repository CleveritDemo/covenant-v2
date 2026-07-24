import React from 'react'
import './PlaneChatComposer.css'

export interface PlaneChatQueueEditButtonProps {
  position: number
  text: string
  emptyText: string
  images: Array<{ id: string; previewUrl: string; name: string }>
  title: string
  onClick: () => void
}

/** Abre el turno encolado para editarlo. */
export const PlaneChatQueueEditButton: React.FC<PlaneChatQueueEditButtonProps> = ({
  position,
  text,
  emptyText,
  images,
  title,
  onClick,
}) => (
  <button
    type="button"
    className="plane-chat-composer__queue-open"
    title={title}
    aria-label={title}
    onClick={onClick}
  >
    <span className="plane-chat-composer__queue-pos" aria-hidden="true">
      {position}
    </span>
    {images.length > 0 && (
      <span className="plane-chat-composer__queue-images">
        {images.map(image => (
          <img
            key={image.id}
            className="plane-chat-composer__queue-image"
            src={image.previewUrl}
            alt={image.name}
          />
        ))}
      </span>
    )}
    {(text || images.length === 0) && (
      <span className="plane-chat-composer__queue-text">
        {text || emptyText}
      </span>
    )}
  </button>
)
