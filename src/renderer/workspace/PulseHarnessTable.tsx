import React from 'react'
import { useT } from '@i18n/useT'
import { agentCliSpec, isAgentCliProvider } from '@shared/agentCliProviders'
import { dayFromMs, type PulseProviderStat } from '@shared/pulseEvents'
import { Tooltip } from '../components/ui/Tooltip'
import './PulseHarnessTable.css'

export interface PulseHarnessTableProps {
  providers: PulseProviderStat[]
}

/** Mismo contrato que PulseView (`pulse-agent__num`): entero o compacto desde 1M. */
function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

const COMPACT_FROM = 1_000_000

function formatStat(value: number): string {
  const n = Math.round(value)
  if (n < COMPACT_FROM) return formatNumber(n)
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function providerLabel(provider: string): string {
  return isAgentCliProvider(provider) ? agentCliSpec(provider).label : provider
}

const TokenCell: React.FC<{
  value: number
  row: PulseProviderStat
  showPartial: boolean
}> = ({ value, row, showPartial }) => {
  const { t } = useT()

  if (row.measuredTurns === 0) {
    return (
      <Tooltip content={t('pulse.harness_noMeasure')}>
        <span className="pulse-harness__dash" aria-label={t('pulse.harness_noMeasure')}>
          —
        </span>
      </Tooltip>
    )
  }

  const text = formatStat(value)

  if (showPartial && row.measuredTurns < row.turns) {
    return (
      <span className="pulse-harness__tokens">
        <span>{text}</span>
        <Tooltip
          content={t('pulse.harness_partial', {
            measured: row.measuredTurns,
            turns: row.turns,
          })}
        >
          <span className="pulse-harness__partial" aria-hidden="true">
            ≈
          </span>
        </Tooltip>
      </span>
    )
  }

  return <span>{text}</span>
}

const AgentChips: React.FC<{ agents: PulseProviderStat['agents'] }> = ({ agents }) => {
  const visible = agents.slice(0, 3)
  const extra = agents.length - visible.length

  return (
    <span className="pulse-harness__agents">
      {visible.map(({ agentId }) => (
        <span key={agentId} className="pulse-harness__agent">
          {agentId}
        </span>
      ))}
      {extra > 0 ? <span className="pulse-harness__agent-more">+{extra}</span> : null}
    </span>
  )
}

export const PulseHarnessTable: React.FC<PulseHarnessTableProps> = ({ providers }) => {
  const { t } = useT()

  if (providers.length === 0) {
    return <p className="pulse-harness__empty">{t('pulse.harness_empty')}</p>
  }

  return (
    <div className="pulse-harness" role="table" aria-label={t('pulse.harness_title')}>
      <div className="pulse-harness__head" role="rowgroup">
        <div className="pulse-harness__row pulse-harness__row--head" role="row">
          <span className="pulse-harness__cell pulse-harness__cell--harness" role="columnheader">
            {t('pulse.harness_colHarness')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--num" role="columnheader">
            {t('pulse.harness_colTurns')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--num" role="columnheader">
            {t('pulse.harness_colTokensIn')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--num" role="columnheader">
            {t('pulse.harness_colTokensOut')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--num" role="columnheader">
            {t('pulse.harness_colTotal')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--agents" role="columnheader">
            {t('pulse.harness_colAgents')}
          </span>
          <span className="pulse-harness__cell pulse-harness__cell--last" role="columnheader">
            {t('pulse.harness_colLast')}
          </span>
        </div>
      </div>
      <div className="pulse-harness__body" role="rowgroup">
        {providers.map(row => (
          <div key={row.provider} className="pulse-harness__row" role="row">
            <span className="pulse-harness__cell pulse-harness__cell--harness" role="cell">
              <span className="pulse-harness__name">{providerLabel(row.provider)}</span>
              <span className="pulse-harness__id">{row.provider}</span>
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--num" role="cell">
              {formatStat(row.turns)}
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--num" role="cell">
              <TokenCell value={row.tokensIn} row={row} showPartial={false} />
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--num" role="cell">
              <TokenCell value={row.tokensOut} row={row} showPartial={false} />
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--num" role="cell">
              <TokenCell value={row.tokens} row={row} showPartial />
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--agents" role="cell">
              <AgentChips agents={row.agents} />
            </span>
            <span className="pulse-harness__cell pulse-harness__cell--last" role="cell">
              {row.lastTs > 0 ? dayFromMs(row.lastTs) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
