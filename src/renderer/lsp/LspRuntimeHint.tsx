import React from 'react'
import { useT } from '@i18n/useT'
import type { LspRuntimeSuggestion } from '@shared/lspTypes'
import './LspRuntimeHint.css'

interface LspRuntimeHintProps {
  name: string
  min: string
  found: string | null
  suggestion: LspRuntimeSuggestion | null
}

/**
 * Aviso de runtime ausente o viejo: el mismo copy del banner del editor,
 * reutilizado en Ajustes para no perder el diagnóstico al instalar desde ahí.
 */
export const LspRuntimeHint: React.FC<LspRuntimeHintProps> = ({
  name,
  min,
  found,
  suggestion,
}) => {
  const { t } = useT()
  return (
    <span className="lsp-runtime-hint">
      <span>
        {found
          ? t('lsp.runtime.tooOld', { name, min, found })
          : t('lsp.runtime.missing', { name, min })}
      </span>
      {suggestion?.kind === 'onDiskNotOnPath' && (
        <>
          <span>{t('lsp.runtime.onDiskNotOnPath', { version: suggestion.version, dir: suggestion.dir })}</span>
          <code className="lsp-runtime-hint__command">{`export PATH="${suggestion.dir}:$PATH"`}</code>
        </>
      )}
      {suggestion?.kind === 'install' && (
        <>
          <span>{t('lsp.runtime.install')}</span>
          <code className="lsp-runtime-hint__command">{suggestion.hint}</code>
        </>
      )}
    </span>
  )
}
