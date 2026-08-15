import React, { useLayoutEffect, useRef } from 'react'
import './PlaneChatDock.css'

export interface PlaneChatDockProps {
  chat: React.ReactNode
  composer: React.ReactNode
  /** Controles flotantes en el fade superior del chat (hilos / limpiar). */
  toolbar?: React.ReactNode
}

/**
 * Chat bajo las ventanas del plano; composer en capa superior.
 * Mide el alto real del composer y publica --plane-composer-clearance
 * para que el padding del chat no deje un hueco fijo de más.
 */
export const PlaneChatDock: React.FC<PlaneChatDockProps> = ({ chat, composer, toolbar }) => {
  const dockRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const dock = dockRef.current
    const shell = shellRef.current
    if (!dock || !shell) return

    let resizeObserver: ResizeObserver | null = null
    let observedComposer: HTMLElement | null = null

    const clearClearance = (): void => {
      dock.style.removeProperty('--plane-composer-clearance')
    }

    const apply = (composerEl: HTMLElement): void => {
      const height = Math.ceil(composerEl.getBoundingClientRect().height)
      if (height <= 0) {
        clearClearance()
        return
      }
      dock.style.setProperty('--plane-composer-clearance', `${height}px`)
    }

    const detachResize = (): void => {
      resizeObserver?.disconnect()
      resizeObserver = null
      observedComposer = null
    }

    const attachToComposer = (composerEl: HTMLElement | null): void => {
      if (composerEl === observedComposer) {
        if (composerEl) apply(composerEl)
        return
      }

      detachResize()

      if (!composerEl) {
        clearClearance()
        return
      }

      observedComposer = composerEl
      apply(composerEl)

      if (typeof ResizeObserver === 'undefined') return
      resizeObserver = new ResizeObserver(() => {
        if (observedComposer) apply(observedComposer)
      })
      resizeObserver.observe(composerEl)
    }

    const syncComposer = (): void => {
      attachToComposer(shell.querySelector('.plane-chat-composer') as HTMLElement | null)
    }

    syncComposer()

    const mutationObserver = new MutationObserver(syncComposer)
    mutationObserver.observe(shell, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      detachResize()
      clearClearance()
    }
  }, [])

  return (
    <>
      <div ref={dockRef} className="plane-chat-dock">
        <div className="plane-chat-dock__chat">{chat}</div>
      </div>
      {toolbar ? (
        <div className="plane-chat-dock__toolbar-host">
          <div className="plane-chat-dock__toolbar">{toolbar}</div>
        </div>
      ) : null}
      <div ref={shellRef} className="plane-chat-dock__composer-shell">{composer}</div>
    </>
  )
}
