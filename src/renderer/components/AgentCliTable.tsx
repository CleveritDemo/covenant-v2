import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AGENT_CLI_PROVIDER_IDS,
  agentCliCommand,
  agentCliSpec,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { Input } from './ui/Input'
import { Icon } from './ui/Icon'
import { BrandIcon } from './ui/BrandIcon'
import './AgentCliTable.css'

/** Margen para no lanzar una comprobación por tecla mientras se escribe la ruta. */
const CHECK_DEBOUNCE_MS = 400

type RowState = { status: 'checking' } | { status: 'done'; resolution: AgentCliResolution }

interface Props {
  commands: Partial<Record<AgentCliProvider, string>>
  onChange: (provider: AgentCliProvider, value: string) => void
}

/**
 * Un renglón por CLI con su disponibilidad real en el PATH; el input aparece
 * al abrir la fila. Sustituye a nueve campos apilados que no decían si el
 * binario existía hasta que fallaba el agente.
 */
export const AgentCliTable: React.FC<Props> = ({ commands, onChange }) => {
  const { t } = useT()
  const [rows, setRows] = useState<Partial<Record<AgentCliProvider, RowState>>>({})
  const [openId, setOpenId] = useState<AgentCliProvider | null>(null)
  const [filter, setFilter] = useState('')
  const timers = useRef<Partial<Record<AgentCliProvider, ReturnType<typeof setTimeout>>>>({})
  /** Contador por proveedor: descarta respuestas de comprobaciones ya superadas. */
  const seq = useRef<Partial<Record<AgentCliProvider, number>>>({})

  const check = useCallback(async (provider: AgentCliProvider, command?: string): Promise<void> => {
    const ticket = (seq.current[provider] ?? 0) + 1
    seq.current[provider] = ticket
    setRows(prev => ({ ...prev, [provider]: { status: 'checking' } }))

    const resolution = await window.api.resolveAgentCli(provider, command)
    if (seq.current[provider] !== ticket) return // llegó tarde: ya hay otra en curso
    setRows(prev => ({
      ...prev,
      [provider]: resolution ? { status: 'done', resolution } : undefined,
    }))
  }, [])

  // Sólo al montar: los cambios posteriores los dispara el debounce del input.
  useEffect(() => {
    for (const provider of AGENT_CLI_PROVIDER_IDS) void check(provider, commands[provider])
    const pending = timers.current
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer)
    }
  }, [check]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (provider: AgentCliProvider, value: string): void => {
    onChange(provider, value)
    clearTimeout(timers.current[provider])
    timers.current[provider] = setTimeout(() => void check(provider, value), CHECK_DEBOUNCE_MS)
  }

  const found = AGENT_CLI_PROVIDER_IDS.filter(provider => {
    const row = rows[provider]
    return row?.status === 'done' && row.resolution.path !== null
  }).length

  const needle = filter.trim().toLowerCase()
  const visible = needle
    ? AGENT_CLI_PROVIDER_IDS.filter(provider =>
        agentCliSpec(provider).label.toLowerCase().includes(needle)
        || agentCliCommand(commands, provider).toLowerCase().includes(needle))
    : AGENT_CLI_PROVIDER_IDS

  return (
    <div className="agent-cli-table">
      <div className="agent-cli-table__head">
        <p className="settings-hint settings-hint--block">{t('settings.agentCliHint')}</p>
        <span className="agent-cli-table__tally">
          {t('settings.cliAvailable', { found, total: AGENT_CLI_PROVIDER_IDS.length })}
        </span>
      </div>

      <Input
        type="search"
        size="sm"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={t('settings.cliFilterPlaceholder')}
        aria-label={t('settings.cliFilterPlaceholder')}
        spellCheck={false}
      />

      <div className="agent-cli-table__rows">
        {visible.length === 0 && (
          <p className="agent-cli-table__empty">{t('settings.cliFilterEmpty', { filter })}</p>
        )}
        {visible.map(provider => {
          const spec = agentCliSpec(provider)
          const row = rows[provider]
          const open = openId === provider
          const resolution = row?.status === 'done' ? row.resolution : null
          const state = !row || row.status === 'checking'
            ? 'checking'
            : resolution?.path
              ? 'found'
              : 'missing'

          return (
            <div className="agent-cli-row" key={provider}>
              <button
                type="button"
                className="agent-cli-row__summary"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : provider)}
              >
                <BrandIcon provider={provider} size={14} />
                <span className="agent-cli-row__name">{spec.label}</span>
                <span className="agent-cli-row__cmd">{agentCliCommand(commands, provider)}</span>
                <span className="agent-cli-row__status" data-state={state}>
                  <span className="agent-cli-row__led" aria-hidden="true" />
                  {state === 'checking' && t('settings.cliChecking')}
                  {state === 'found' && (resolution?.version
                    ? `v${resolution.version}`
                    : t('settings.cliFound'))}
                  {state === 'missing' && t('settings.cliNotFound')}
                </span>
                <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} aria-hidden />
              </button>

              {open && (
                <div className="agent-cli-row__edit">
                  <Input
                    type="text"
                    size="sm"
                    value={commands[provider] ?? ''}
                    onChange={e => handleChange(provider, e.target.value)}
                    placeholder={spec.command}
                    aria-label={t('settings.cliCommandLabel', { label: spec.label })}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p className="agent-cli-row__note" data-state={state}>
                    {state === 'found' && resolution?.path}
                    {state === 'missing' && t('settings.cliNotFoundHint')}
                    {state === 'checking' && t('settings.cliChecking')}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
