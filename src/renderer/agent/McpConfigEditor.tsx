import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { validateMcpConfigText } from '@shared/mcpConfigText'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui'
import { FileCodeEditor } from '../terminal/explorer/FileCodeEditor'
import './McpConfigEditor.css'

/** Con qué arranca el editor cuando el archivo todavía no existe. */
const SEED = `{\n  "mcpServers": {}\n}\n`

export interface McpConfigEditorProps {
  provider: AgentCliProvider
  cwd: string
  /** Guardado con éxito: la estantería recarga sus filas. */
  onSaved: () => void
}

interface Doc {
  path: string
  /** Lo que se está editando. */
  text: string
  /** Lo que había en disco al abrir; `''` si el archivo no existía. */
  disk: string
}

/**
 * El archivo de config MCP del CLI, editable sin salir de Covenant.
 *
 * Reusa el editor del explorador (CodeMirror, JSON por extensión) sin
 * `sessionId`, que es lo que apaga el LSP: aquí no hay proyecto que indexar.
 * El tema lo pide el propio componente en vez de bajarlo cuatro saltos por
 * props desde `App`.
 */
export const McpConfigEditor: React.FC<McpConfigEditorProps> = ({ provider, cwd, onSaved }) => {
  const { t } = useT()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [themeId, setThemeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  /**
   * `t` es una identidad nueva en cada render. Si entra en las deps de `load`,
   * el efecto se redispara con cada setState y el componente gira sin parar.
   */
  const tRef = useRef(t)
  tRef.current = t

  const load = useCallback((): (() => void) => {
    let alive = true
    setConflict(false)
    setSaved(false)
    void Promise.all([
      window.api.readMcpConfig({ provider, cwd }),
      window.api.getConfig(),
    ]).then(([res, cfg]) => {
      if (!alive) return
      setThemeId(cfg.themeId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError('')
      setDoc({
        path: res.path,
        text: res.exists && res.text.trim() ? res.text : SEED,
        disk: res.exists ? res.text : '',
      })
    }).catch(() => { if (alive) setError(tRef.current('agentPane.mcpEditLoadFailed')) })
    return () => { alive = false }
  }, [provider, cwd])

  useEffect(() => load(), [load])

  const check = useMemo(
    () => (doc ? validateMcpConfigText(doc.text) : null),
    [doc],
  )
  const dirty = doc !== null && doc.text !== doc.disk

  /** `force` reenvía sin `expected`: es el «sobrescribir» del aviso. */
  const save = (force = false): void => {
    if (!doc || !check?.ok || saving) return
    setSaving(true)
    setError('')
    setConflict(false)
    void window.api.writeMcpConfig({
      provider,
      cwd,
      text: doc.text,
      ...(force ? {} : { expected: doc.disk }),
    }).then(res => {
      if (res.ok) {
        setDoc(current => (current ? { ...current, disk: current.text } : current))
        setSaved(true)
        onSaved()
      } else if (res.error === 'changed-outside') {
        setConflict(true)
      } else {
        setError(res.error)
      }
    }).catch(() => setError(t('agentPane.mcpEditSaveFailed')))
      .finally(() => setSaving(false))
  }

  if (!doc) {
    return (
      <div className="mcp-editor">
        <p className="mcp-editor__note">
          {error || t('agentPane.mcpsLoading')}
        </p>
      </div>
    )
  }

  return (
    <div className="mcp-editor">
      <div className="mcp-editor__code">
        <FileCodeEditor
          filePath={doc.path}
          themeId={themeId}
          content={doc.text}
          onChange={text => {
            setDoc(current => (current ? { ...current, text } : current))
            setSaved(false)
          }}
          onSave={() => save()}
        />
      </div>

      {conflict && (
        <div className="mcp-editor__conflict">
          <span>{t('agentPane.mcpEditConflict')}</span>
          <Button variant="ghost" size="sm" onClick={() => load()}>
            {t('agentPane.mcpEditReload')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => save(true)}>
            {t('agentPane.mcpEditOverwrite')}
          </Button>
        </div>
      )}

      {error ? <p className="mcp-editor__error">{error}</p> : null}

      <div className="mcp-editor__foot">
        <span
          className={[
            'mcp-editor__status',
            check?.ok ? '' : 'mcp-editor__status--bad',
          ].filter(Boolean).join(' ')}
        >
          {check?.ok
            ? t('agentPane.mcpEditValid', { n: check.servers.length })
            : t(`agentPane.mcpEditInvalid_${check?.reason ?? 'empty'}`)}
        </span>
        <span className="mcp-editor__spacer" />
        {saved && !dirty ? (
          <span className="mcp-editor__saved">{t('agentPane.mcpEditSaved')}</span>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          disabled={!check?.ok || !dirty || saving}
          onClick={() => save()}
        >
          {t('agentPane.mcpEditSave')}
        </Button>
      </div>
    </div>
  )
}
