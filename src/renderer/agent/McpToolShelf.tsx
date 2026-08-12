import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { agentCliSpec } from '@shared/agentCliProviders'
import {
  buildMcpToolRows,
  mcpScopeModeFor,
  type McpServersListResult,
  type McpToolRow,
} from '@shared/mcpContext'
import { mcpConnectHint } from '@shared/mcpProbe'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { McpConfigEditor } from './McpConfigEditor'
import './McpToolShelf.css'

export interface McpToolShelfProps {
  provider: AgentCliProvider
  cwd: string
  /** Nombres permitidos; vacío = el agente usa todas las que encuentre el CLI. */
  value: string[]
  /** Config bloqueada (turno en curso) o CLI sin acotado. */
  locked: boolean
  /** false = este CLI no sabe acotar herramientas al lanzar. */
  canScope: boolean
  onChange: (mcpsAllowed: string[]) => void
}

/**
 * Herramientas (MCP) del agente como estantería: cada servidor es una fila con
 * su estado y la acción que lo arregla.
 *
 * Sustituye a la lista de casillas con cuatro párrafos alrededor: lo que antes
 * era «declara jira también en la config de este CLI» ahora es un botón, porque
 * la app ya sabe escribir ese archivo.
 */
export const McpToolShelf: React.FC<McpToolShelfProps> = ({
  provider,
  cwd,
  value,
  locked,
  canScope,
  onChange,
}) => {
  const { t } = useT()
  const [result, setResult] = useState<McpServersListResult | null>(null)
  const [busyName, setBusyName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  /**
   * Elegir «Solo estas» con nada marcado todavía. El modo real se deriva de la
   * lista (vacía = todas), así que sin esto no habría forma de enseñar las
   * casillas para marcar la primera.
   * ponytail: intención local, no se persiste. Si hiciera falta que «solo
   * estas, ninguna» sobreviva al cierre, hay que guardar el modo en el agente.
   */
  const [pickIntent, setPickIntent] = useState(false)

  const providerLabel = agentCliSpec(provider).label
  const mode: 'all' | 'pick' = !canScope
    ? 'all'
    : (value.length > 0 || pickIntent ? 'pick' : 'all')

  const load = useCallback(() => {
    let alive = true
    window.api.listMcpServers({ provider, cwd })
      .then(next => { if (alive) setResult(next) })
      .catch(() => { if (alive) setResult(null) })
    return () => { alive = false }
  }, [provider, cwd])

  useEffect(() => {
    setResult(null)
    setError('')
    setNotice('')
    return load()
  }, [load])

  const rows = useMemo<McpToolRow[]>(() => buildMcpToolRows({
    servers: result?.servers ?? [],
    unreadProjectServers: result?.unreadProjectServers ?? [],
    allowed: value,
  }), [result, value])

  const configuredCount = rows.filter(row =>
    row.state === 'ready' || row.state === 'needsAuth' || row.state === 'unreachable',
  ).length
  const readyCount = rows.filter(row => row.state === 'ready').length

  const toggle = (name: string): void => {
    onChange(value.includes(name)
      ? value.filter(item => item !== name)
      : [...value, name])
  }

  /** Copia el servidor del proyecto a la config de este CLI y recarga. */
  const importServer = (name: string): void => {
    setBusyName(name)
    setError('')
    setNotice('')
    void window.api.importProjectMcpServer({ provider, cwd, name })
      .then(res => {
        if (!res.ok) setError(res.error ?? t('agentPane.mcpImportFailed'))
        load()
      })
      .catch(() => setError(t('agentPane.mcpImportFailed')))
      .finally(() => setBusyName(''))
  }

  const connectServer = (row: McpToolRow): void => {
    setError('')
    setNotice('')
    const hint = mcpConnectHint({
      provider: providerLabel,
      serverName: row.name,
      url: row.url,
    })
    void navigator.clipboard.writeText(hint).then(
      () => setNotice(t('agentPane.mcpConnectCopied')),
      () => setError(t('agentPane.mcpConnectCopyFailed')),
    )
  }

  const openConfigFile = (): void => {
    const create = result?.fileExists === false
    void window.api.revealMcpConfig({ provider, cwd, create }).then(res => {
      if (res.ok && create) load()
    })
  }

  if (result === null) {
    return (
      <div className="mcp-shelf">
        <span className="mcp-shelf__label">{t('agentPane.mcpToolsLabel')}</span>
        <p className="mcp-shelf__note">{t('agentPane.mcpsLoading')}</p>
      </div>
    )
  }

  return (
    <div className="mcp-shelf">
      <span className="mcp-shelf__label">{t('agentPane.mcpToolsLabel')}</span>

      <div className="mcp-shelf__mode">
        <div className="mcp-shelf__mode-opts" role="radiogroup" aria-label={t('agentPane.mcpToolsLabel')}>
          <button
            type="button"
            className="mcp-shelf__mode-opt"
            role="radio"
            aria-checked={mode === 'all'}
            disabled={locked || !canScope}
            onClick={() => { setPickIntent(false); onChange([]) }}
          >
            <span className="mcp-shelf__dot" aria-hidden="true" />
            <span>{t('agentPane.mcpModeAll')}</span>
          </button>
          <button
            type="button"
            className="mcp-shelf__mode-opt"
            role="radio"
            aria-checked={mode === 'pick'}
            disabled={locked || !canScope}
            onClick={() => setPickIntent(true)}
          >
            <span className="mcp-shelf__dot" aria-hidden="true" />
            <span>{t('agentPane.mcpModePick')}</span>
          </button>
        </div>
        <p className="mcp-shelf__why">
          {!canScope
            ? t('agentPane.mcpUnsupported', { provider: providerLabel })
            : mode === 'pick'
              ? t(`agentPane.mcpWhyPick_${mcpScopeModeFor(provider)}`, { provider: providerLabel })
              : t('agentPane.mcpWhyAll', { provider: providerLabel })}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mcp-shelf__note">
          {t('agentPane.mcpToolsEmpty', { provider: providerLabel })}
        </p>
      ) : (
        <ul className="mcp-shelf__rows">
          {rows.map(row => {
            const checked = value.includes(row.name)
            const canCheck = mode === 'pick' && row.state !== 'project'
            return (
              <li
                key={row.name}
                className={[
                  'mcp-shelf__row',
                  row.state === 'project' ? 'mcp-shelf__row--project' : '',
                ].filter(Boolean).join(' ')}
              >
                {canCheck ? (
                  <button
                    type="button"
                    className="mcp-shelf__check"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={row.name}
                    disabled={locked}
                    onClick={() => toggle(row.name)}
                  />
                ) : (
                  <span className="mcp-shelf__check mcp-shelf__check--off" aria-hidden="true" />
                )}
                <span className="mcp-shelf__name">{row.name}</span>
                {row.transport ? (
                  <span className="mcp-shelf__transport">{row.transport}</span>
                ) : null}
                <span className="mcp-shelf__spacer" />
                {row.state === 'ready' ? (
                  <span className="mcp-shelf__chip mcp-shelf__chip--ready">
                    {t('agentPane.mcpStateReady')}
                  </span>
                ) : null}
                {row.state === 'needsAuth' ? (
                  <>
                    <span className="mcp-shelf__chip mcp-shelf__chip--needs-auth">
                      {t('agentPane.mcpStateNeedsAuth')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked || busyName === row.name}
                      onClick={() => connectServer(row)}
                    >
                      {t('agentPane.mcpConnectAction')}
                    </Button>
                  </>
                ) : null}
                {row.state === 'unreachable' ? (
                  <span className="mcp-shelf__chip mcp-shelf__chip--unreachable">
                    {t('agentPane.mcpStateUnreachable')}
                  </span>
                ) : null}
                {row.state === 'missing' ? (
                  <span className="mcp-shelf__chip mcp-shelf__chip--missing">
                    {t('agentPane.mcpStateMissing')}
                  </span>
                ) : null}
                {row.state === 'project' ? (
                  <>
                    <span className="mcp-shelf__chip mcp-shelf__chip--project">
                      {t('agentPane.mcpStateProject')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked || busyName === row.name}
                      onClick={() => importServer(row.name)}
                    >
                      {t('agentPane.mcpImportAction', { provider: providerLabel })}
                    </Button>
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {error ? <p className="mcp-shelf__error">{error}</p> : null}
      {notice ? <p className="mcp-shelf__note">{notice}</p> : null}

      <div className="mcp-shelf__foot">
        <span className="mcp-shelf__source">
          <Icon name="files" size={11} aria-hidden />
          {t('agentPane.mcpSource', { file: result.file })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          pressed={editing}
          onClick={() => setEditing(open => !open)}
        >
          {t('agentPane.mcpEditAction')}
        </Button>
        <Button variant="ghost" size="sm" onClick={openConfigFile}>
          {t(result.fileExists ? 'agentPane.mcpsOpenFile' : 'agentPane.mcpsCreateFile')}
        </Button>
        <span className="mcp-shelf__spacer" />
        <span className="mcp-shelf__count">
          {mode === 'pick'
            ? t('agentPane.mcpCountPicked', { n: value.length, total: configuredCount })
            : t('agentPane.mcpCountAvailable', { n: readyCount })}
        </span>
      </div>

      {editing && <McpConfigEditor provider={provider} cwd={cwd} onSaved={load} />}
    </div>
  )
}
