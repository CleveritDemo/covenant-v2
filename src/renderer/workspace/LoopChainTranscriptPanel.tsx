import React, { useEffect, useState } from 'react'
import type { LoopChainTranscript, LoopChainTranscriptEntry } from '@shared/loopChainEvents'
import { useT } from '@i18n/useT'
import { Spinner } from '../components/ui/Spinner'
import './LoopChainTranscriptPanel.css'

export interface LoopChainTranscriptPanelProps {
  chainId: string
  agentTitleById: ReadonlyMap<string, string>
}

/** Conversación headless de una cadena; vive solo dentro del módulo Loops. */
export const LoopChainTranscriptPanel: React.FC<LoopChainTranscriptPanelProps> = ({
  chainId,
  agentTitleById,
}) => {
  const { t } = useT()
  const [transcript, setTranscript] = useState<LoopChainTranscript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void window.api.getLoopChainTranscript(chainId).then(result => {
      if (cancelled) return
      if (!result) {
        setTranscript(null)
        setError(t('tabs.loopsTranscriptUnavailable'))
      } else {
        setTranscript(result)
      }
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setTranscript(null)
      setError(t('tabs.loopsTranscriptUnavailable'))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [chainId, t])

  useEffect(() => {
    const unsub = window.api.onLoopChainEvent(chainId, event => {
      if (event.type !== 'step_final' && event.type !== 'error') return
      void window.api.getLoopChainTranscript(chainId).then(result => {
        if (result) setTranscript(result)
      })
    })
    return unsub
  }, [chainId])

  const renderEntry = (entry: LoopChainTranscriptEntry): React.ReactNode => {
    const agentTitle = agentTitleById.get(entry.agentId) ?? entry.agentId
    return (
      <li key={`${entry.cycle}-${entry.stepIndex}-${entry.timestamp}`} className="loop-chain-transcript__entry">
        <header className="loop-chain-transcript__entry-head">
          <span className="loop-chain-transcript__entry-meta">
            {t('tabs.loopsTranscriptTurn', {
              cycle: entry.cycle,
              step: entry.stepIndex + 1,
            })}
          </span>
          <span className="loop-chain-transcript__entry-agent">{agentTitle}</span>
        </header>
        <p className="loop-chain-transcript__prompt">{entry.prompt}</p>
        {entry.error ? (
          <p className="loop-chain-transcript__error">{entry.error}</p>
        ) : entry.text.trim() ? (
          <p className="loop-chain-transcript__text">{entry.text}</p>
        ) : (
          <p className="loop-chain-transcript__muted">{t('tabs.loopsTranscriptEmpty')}</p>
        )}
      </li>
    )
  }

  if (loading) {
    return (
      <div className="loop-chain-transcript loop-chain-transcript--loading">
        <Spinner />
        <span>{t('tabs.loopsTranscriptLoading')}</span>
      </div>
    )
  }

  if (error) {
    return <p className="loop-chain-transcript loop-chain-transcript--error">{error}</p>
  }

  const entries = transcript?.entries ?? []
  if (entries.length === 0) {
    return <p className="loop-chain-transcript loop-chain-transcript--empty">{t('tabs.loopsTranscriptEmpty')}</p>
  }

  return (
    <ul className="loop-chain-transcript" aria-label={t('tabs.loopsTranscriptTitle')}>
      {entries.map(renderEntry)}
    </ul>
  )
}
