import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import {
  AI_MESSAGES_NEAR_BOTTOM_PX,
  isAiMessagesNearBottom,
  scrollAiMessagesToBottom,
} from './aiMessagesScroll'

export interface AiMessagesFollowEntry {
  isStreaming?: boolean
}

/**
 * Mantiene el chat pegado al fondo sólo mientras el usuario siga en el fondo.
 * La decisión usa la posición *antes* de que crezca el contenido (scrollHeight
 * previo), para no perder el follow cuando el DOM ya es más alto.
 * `forceFollow()` reanuda el follow (p. ej. al enviar un mensaje).
 */
export function useAiMessagesFollowScroll(
  messages: readonly unknown[],
  expanded: boolean,
  scrollRef: RefObject<HTMLDivElement | null>,
  /** Disparador extra (p. ej. activity/cola) sin alterar la decisión de follow. */
  stickTrigger?: unknown,
): { nearBottom: boolean; forceFollow: () => void } {
  const shouldFollowRef = useRef(true)
  const ignoringScrollRef = useRef(false)
  const prevScrollHeightRef = useRef(0)
  const prevScrollTopRef = useRef(0)
  const [nearBottom, setNearBottom] = useState(true)

  const snapToBottom = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    ignoringScrollRef.current = true
    shouldFollowRef.current = true
    setNearBottom(true)
    scrollAiMessagesToBottom(el, true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ignoringScrollRef.current = false
        prevScrollHeightRef.current = el.scrollHeight
        prevScrollTopRef.current = el.scrollTop
      })
    })
  }, [scrollRef])

  const forceFollow = useCallback((): void => {
    shouldFollowRef.current = true
    setNearBottom(true)
    snapToBottom()
  }, [snapToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateShouldFollow = (): void => {
      if (ignoringScrollRef.current) return
      const height = el.scrollHeight
      const top = el.scrollTop
      const prevHeight = prevScrollHeightRef.current
      // Si creció el contenido, no interpretar “ya no estoy abajo” como scroll
      // manual: el layout effect se encargará de seguir el fondo.
      if (prevHeight > 0 && height !== prevHeight) {
        const wasNearPreviousBottom = prevHeight <= el.clientHeight
          || prevHeight - el.clientHeight - top <= AI_MESSAGES_NEAR_BOTTOM_PX
        if (wasNearPreviousBottom) {
          shouldFollowRef.current = true
          setNearBottom(true)
        }
        return
      }
      const near = isAiMessagesNearBottom(el)
      shouldFollowRef.current = near
      setNearBottom(near)
      prevScrollHeightRef.current = height
      prevScrollTopRef.current = top
    }

    updateShouldFollow()
    el.addEventListener('scroll', updateShouldFollow, { passive: true })
    return () => el.removeEventListener('scroll', updateShouldFollow)
  }, [scrollRef])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const prevHeight = prevScrollHeightRef.current
    const prevTop = prevScrollTopRef.current
    const grew = el.scrollHeight > prevHeight && prevHeight > 0
    const wasNearPreviousBottom = prevHeight <= el.clientHeight
      || prevHeight - el.clientHeight - prevTop <= AI_MESSAGES_NEAR_BOTTOM_PX

    if (shouldFollowRef.current || (grew && wasNearPreviousBottom)) {
      shouldFollowRef.current = true
      setNearBottom(true)
      ignoringScrollRef.current = true
      scrollAiMessagesToBottom(el, true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ignoringScrollRef.current = false
          prevScrollHeightRef.current = el.scrollHeight
          prevScrollTopRef.current = el.scrollTop
        })
      })
      return
    }

    prevScrollHeightRef.current = el.scrollHeight
    prevScrollTopRef.current = el.scrollTop
  }, [messages, stickTrigger, scrollRef])

  useLayoutEffect(() => {
    if (!expanded) return
    snapToBottom()
  }, [expanded, snapToBottom])

  return { nearBottom, forceFollow }
}
