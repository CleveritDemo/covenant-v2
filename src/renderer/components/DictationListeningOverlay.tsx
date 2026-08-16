import React, { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DictationInterimText } from './DictationInterimText'
import { DICTATION_LEVEL_SPAWN_THRESHOLD } from './dictationMicParticles'
import './DictationListeningOverlay.css'

export type DictationOverlayScope = 'chat-dock' | 'messages' | 'embedded'

export interface DictationListeningOverlayProps {
  active: boolean
  /** Pico de mic 0–1; modula scrim, texto y animación del botón mic. */
  level?: number
  /** Interim o etiqueta «Te escucho…». */
  text: string
  /** true cuando hay transcript parcial (no placeholder). */
  streaming?: boolean
  /** Dónde montar el scrim: dock del plano, mensajes del pane o composer embebido. */
  scope?: DictationOverlayScope
  /** Raíz explícita para `embedded` (p. ej. wiki curator). */
  portalRoot?: HTMLElement | null
  portalRootRef?: RefObject<HTMLElement | null>
}

function resolvePortalRoot(
  scope: DictationOverlayScope,
  portalRoot?: HTMLElement | null,
  portalRootRef?: RefObject<HTMLElement | null>,
): HTMLElement | null {
  if (portalRoot) return portalRoot
  if (portalRootRef?.current) return portalRootRef.current
  if (typeof document === 'undefined') return null
  if (scope === 'chat-dock') {
    return document.querySelector('.plane-chat-dock')
  }
  if (scope === 'messages') {
    return document.querySelector('.agent-pane__messages-wrap')
  }
  return document.querySelector('.wiki-curator-composer')
    ?? document.querySelector('.plane-chat-composer')
}

/**
 * Dictado activo: oscurece el chat y muestra el interim en grande al centro.
 * La animación de audio vive en el botón mic (`PlaneChatSendButton` / `AgentPaneSendButton`).
 */
export const DictationListeningOverlay: React.FC<DictationListeningOverlayProps> = ({
  active,
  level = 0,
  text,
  streaming = false,
  scope = 'chat-dock',
  portalRoot,
  portalRootRef,
}) => {
  const clampedLevel = Math.min(1, Math.max(0, level))
  const live = clampedLevel >= DICTATION_LEVEL_SPAWN_THRESHOLD
  const [mount, setMount] = useState<HTMLElement | null>(() => (
    active ? resolvePortalRoot(scope, portalRoot, portalRootRef) : null
  ))

  useLayoutEffect(() => {
    if (!active) {
      setMount(null)
      return
    }
    setMount(resolvePortalRoot(scope, portalRoot, portalRootRef))
  }, [active, scope, portalRoot, portalRootRef])

  useLayoutEffect(() => {
    if (!mount || !active) return
    mount.classList.add('dictation-listening-host--active')
    mount.style.setProperty('--dictation-level', String(clampedLevel))
    return () => {
      mount.classList.remove('dictation-listening-host--active')
      mount.style.removeProperty('--dictation-level')
    }
  }, [active, mount, clampedLevel])

  if (!active || !mount) return null

  return createPortal(
    <div
      className={[
        'dictation-listening-overlay',
        `dictation-listening-overlay--${scope}`,
        live ? 'dictation-listening-overlay--live' : '',
      ].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{ ['--dictation-level' as string]: String(clampedLevel) }}
    >
      <div className="dictation-listening-overlay__scrim" aria-hidden="true" />
      <DictationInterimText text={text} streaming={streaming} />
    </div>,
    mount,
  )
}
