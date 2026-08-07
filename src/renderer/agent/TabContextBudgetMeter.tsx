import React from 'react'
import type { ContextBudgetSummary } from '@shared/contextBudget'
import { useT } from '@i18n/useT'
import './TabContextBudgetMeter.css'

export interface TabContextBudgetMeterProps {
  summary: ContextBudgetSummary
}

const compact = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)

/** Lo que recibirá el agente y cuánto pesa: la pregunta que el modal debe responder. */
export const TabContextBudgetMeter: React.FC<TabContextBudgetMeterProps> = ({ summary }) => {
  const { t } = useT()
  return (
    <div className="ctx-budget">
      <div className="ctx-budget__stats">
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">{summary.sections}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetSections')}</span>
        </div>
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">{compact(summary.chars)}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetChars')}</span>
        </div>
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">~{compact(summary.estimatedTokens)}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetTokens')}</span>
        </div>
      </div>
      <div
        className={`ctx-budget__meter ctx-budget__meter--${summary.level}`}
        role="progressbar"
        aria-valuenow={Math.round(summary.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('tabContexts.budgetAria')}
      >
        <i style={{ width: `${Math.max(2, summary.ratio * 100)}%` }} />
      </div>
      <p className="ctx-budget__delivery">
        <span className={`ctx-budget__pill ctx-budget__pill--${summary.delivery}`}>
          {t(`tabContexts.delivery_${summary.delivery}`)}
        </span>
        {t(`tabContexts.deliveryHint_${summary.delivery}`)}
      </p>
    </div>
  )
}
