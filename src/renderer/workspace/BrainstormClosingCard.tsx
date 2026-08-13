import React, { useState } from 'react'
import type { BrainstormClosing, CeremonyClosingResult } from '@shared/brainstormRoom'
import { formatBrainstormClosing, formatCeremonyClosing } from '@shared/brainstormRoom'
import {
  aiReadyChecklist,
  ceremonyBlocksAiReady,
  ceremonyById,
  ceremonyGateState,
  parseAiReadyGaps,
} from '@shared/agileCeremonies'
import { brainstormRoomContext } from '@shared/brainstormListing'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui'
import { AI_READY_FIELD_KEY } from './ceremonyLabels'
import './BrainstormClosingCard.css'

export interface BrainstormClosingCardProps {
  roomId: string
  topic: string
  cwd: string
  /** Cierre genérico (salas `free`). Excluyente con `ceremonyClosing`. */
  closing?: BrainstormClosing
  /** Cierre estructurado de una ceremonia, con su gate. */
  ceremonyClosing?: CeremonyClosingResult
  speakerLabel: string
  /** El contexto ya está en disco; el llamador refresca la lista de la pestaña. */
  onContextSaved?: () => void
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null

/**
 * Los puntos de un bloque, o null si es un párrafo suelto. El cierre puede
 * traer varias líneas —lista o no— desde que el turno final dejó de estar
 * limitado a 20 palabras por etiqueta.
 */
function closingBlockItems(value: string): string[] | null {
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  return lines.map(line => line.replace(/^[-*+]\s+/, ''))
}

/** Cierre de la sala: la última entrada del acta, con sus salidas. */
export const BrainstormClosingCard: React.FC<BrainstormClosingCardProps> = ({
  roomId,
  topic,
  cwd,
  closing,
  ceremonyClosing,
  speakerLabel,
  onContextSaved,
}) => {
  const { t } = useT()
  const [feedback, setFeedback] = useState<Feedback>(null)

  const markdown = ceremonyClosing
    ? formatCeremonyClosing(topic, ceremonyClosing)
    : closing
      ? formatBrainstormClosing(topic, closing)
      : ''

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
    // Un contexto por sala (`brainstorm-<slug>.md`): reguardar el cierre lo
    // reescribe en vez de sembrar un archivo nuevo por cada cambio de asunto.
    const context = brainstormRoomContext({ id: roomId, topic })
    const result = await window.api.materializeTabContext({
      context,
      cwd: cwd.trim(),
      content: markdown,
    })
    if (result.ok) onContextSaved?.()
    setFeedback(result.ok
      ? { kind: 'ok', text: t('tabs.brainstormClosingSaved', { name: context.name }) }
      : { kind: 'error', text: result.error ?? t('tabs.brainstormClosingSaveError') })
  }

  const blocks: Array<[string, string | undefined]> = ceremonyClosing
    ? ceremonyClosing.entries.map(entry => [entry.label, entry.value])
    : [
        [t('tabs.brainstormClosingDecision'), closing?.decision],
        [t('tabs.brainstormClosingWhy'), closing?.why],
        [t('tabs.brainstormClosingAgreed'), closing?.agreed],
        [t('tabs.brainstormClosingOpen'), closing?.open],
        [t('tabs.brainstormClosingNext'), closing?.next],
      ]

  const ceremony = ceremonyClosing ? ceremonyById(ceremonyClosing.ceremony) : null
  const gateState = ceremonyClosing
    ? ceremonyGateState(ceremonyClosing.ceremony, ceremonyClosing.fields)
    : 'unknown'
  const blocked = ceremonyClosing
    ? ceremonyBlocksAiReady(ceremonyClosing.ceremony, ceremonyClosing.fields)
    : false
  // El checklist solo existe donde la ceremonia lo pide (Specification Workshop).
  const gaps = ceremonyClosing && 'ai-ready-gaps' in ceremonyClosing.fields
    ? parseAiReadyGaps(ceremonyClosing.fields['ai-ready-gaps'])
    : null
  const checklist = gaps ? aiReadyChecklist(gaps) : null

  return (
    <section className="brainstorm-closing" aria-label={t('tabs.brainstormClosingTitle')}>
      <header className="brainstorm-closing__head">
        <span className="brainstorm-closing__title">
          {t('tabs.brainstormClosingBy', { name: speakerLabel })}
          {ceremony ? (
            <span className="brainstorm-closing__ceremony">{ceremony.name}</span>
          ) : null}
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
        {blocks.map(([label, value]) => {
          if (!value) return null
          const items = closingBlockItems(value)
          return (
            <div key={label} className="brainstorm-closing__block">
              <span className="brainstorm-closing__label">{label}</span>
              {items
                ? (
                  <ul className="brainstorm-closing__list">
                    {items.map((item, index) => (
                      <li key={`${item}-${index}`} className="brainstorm-closing__item">
                        {item}
                      </li>
                    ))}
                  </ul>
                )
                : <span className="brainstorm-closing__text">{value}</span>}
            </div>
          )
        })}
      </div>

      {checklist ? (
        <div className="brainstorm-closing__ready">
          <span className="brainstorm-closing__ready-title">
            {t('tabs.ceremonyAiReadyTitle')}
          </span>
          <ul className="brainstorm-closing__ready-list">
            {checklist.map(item => (
              <li
                key={item.field}
                className={item.ok
                  ? 'brainstorm-closing__ready-row'
                  : 'brainstorm-closing__ready-row brainstorm-closing__ready-row--missing'}
              >
                <span className="brainstorm-closing__ready-mark" aria-hidden>
                  {item.ok ? '✓' : '✕'}
                </span>
                <span>{t(AI_READY_FIELD_KEY[item.field])}</span>
              </li>
            ))}
          </ul>
          <p className="brainstorm-closing__ready-verdict">
            {gaps && gaps.length
              ? t('tabs.ceremonyAiReadyBlocked', { count: String(gaps.length) })
              : t('tabs.ceremonyAiReadyOk')}
          </p>
        </div>
      ) : null}

      {ceremony && gateState !== 'unknown' ? (
        <p
          className={blocked
            ? 'brainstorm-closing__gate brainstorm-closing__gate--blocked'
            : 'brainstorm-closing__gate'}
          role="status"
        >
          {gateState === 'open'
            ? t('tabs.ceremonyGateOpenBanner', { field: ceremony.gate?.field ?? '' })
            : t('tabs.ceremonyGatePassed')}
        </p>
      ) : null}

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
