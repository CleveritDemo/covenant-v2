import React, { useState } from 'react'
import type { BrainstormClosing } from '@shared/brainstormRoom'
import { formatBrainstormClosing } from '@shared/brainstormRoom'
import {
  canonicalContextFileName,
  canonicalContextId,
  type TabContext,
} from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui'
import './BrainstormClosingCard.css'

export interface BrainstormClosingCardProps {
  roomId: string
  topic: string
  cwd: string
  closing: BrainstormClosing
  speakerLabel: string
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null

/** Cierre de la sala: la última entrada del acta, con sus salidas. */
export const BrainstormClosingCard: React.FC<BrainstormClosingCardProps> = ({
  roomId,
  topic,
  cwd,
  closing,
  speakerLabel,
}) => {
  const { t } = useT()
  const [feedback, setFeedback] = useState<Feedback>(null)

  const markdown = formatBrainstormClosing(topic, closing)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(markdown)
      setFeedback({ kind: 'ok', text: t('tabs.brainstormClosingCopied') })
    } catch {
      setFeedback({ kind: 'error', text: t('tabs.brainstormClosingCopyError') })
    }
  }

  const handleExport = async (): Promise<void> => {
    const result = await window.api.exportBrainstormMarkdown(cwd.trim(), roomId)
    setFeedback(result.ok
      ? { kind: 'ok', text: t('tabs.brainstormClosingExported', { path: result.path }) }
      : { kind: 'error', text: result.error })
  }

  const handleSaveContext = async (): Promise<void> => {
    const name = t('tabs.brainstormClosingContextName', { topic })
    const context: TabContext = {
      id: canonicalContextId('notes', { name }),
      name,
      fileName: canonicalContextFileName('notes', { name }),
      kind: 'notes',
    }
    const result = await window.api.materializeTabContext({
      context,
      cwd: cwd.trim(),
      content: markdown,
    })
    setFeedback(result.ok
      ? { kind: 'ok', text: t('tabs.brainstormClosingSaved', { name }) }
      : { kind: 'error', text: result.error ?? t('tabs.brainstormClosingSaveError') })
  }

  const blocks: Array<[string, string | undefined]> = [
    [t('tabs.brainstormClosingDecision'), closing.decision],
    [t('tabs.brainstormClosingWhy'), closing.why],
    [t('tabs.brainstormClosingAgreed'), closing.agreed],
    [t('tabs.brainstormClosingOpen'), closing.open],
    [t('tabs.brainstormClosingNext'), closing.next],
  ]

  return (
    <section className="brainstorm-closing" aria-label={t('tabs.brainstormClosingTitle')}>
      <header className="brainstorm-closing__head">
        <span className="brainstorm-closing__title">
          {t('tabs.brainstormClosingBy', { name: speakerLabel })}
        </span>
        <span className="brainstorm-closing__actions">
          <Button variant="secondary" size="sm" onClick={() => { void handleCopy() }}>
            {t('tabs.brainstormClosingCopy')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { void handleExport() }}>
            {t('tabs.brainstormClosingExport')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { void handleSaveContext() }}>
            {t('tabs.brainstormClosingSaveContext')}
          </Button>
        </span>
      </header>

      <div className="brainstorm-closing__body">
        {blocks.map(([label, value]) => (value ? (
          <p key={label} className="brainstorm-closing__block">
            <span className="brainstorm-closing__label">{label}</span>
            <span className="brainstorm-closing__text">{value}</span>
          </p>
        ) : null))}
      </div>

      {feedback ? (
        <p
          className={feedback.kind === 'error'
            ? 'brainstorm-closing__feedback brainstorm-closing__feedback--error'
            : 'brainstorm-closing__feedback'}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}
    </section>
  )
}
