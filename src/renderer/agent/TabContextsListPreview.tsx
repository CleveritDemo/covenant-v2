import React from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { ContextPreviewBody } from '../workspace/ContextContentPreviewModal'

interface Props {
  context: TabContext | null
  cwd: string
}

/**
 * Panel derecho del modal de listado: la misma lectura Reporte/Fuente que el
 * modal de un contexto suelto. Sin contexto solo se llega con el proyecto vacío.
 */
export const TabContextsListPreview: React.FC<Props> = ({ context, cwd }) => {
  const { t } = useT()

  if (!context) {
    return (
      <section className="tab-contexts__preview-pane">
        <p className="tab-contexts__preview-empty">{t('tabContexts.empty')}</p>
      </section>
    )
  }

  return (
    <section className="tab-contexts__preview-pane">
      <header className="tab-contexts__preview-header">
        <strong>{context.name}</strong>
        <span>{t(`tabContexts.kind_${context.kind}`)}</span>
      </header>
      {/* Sin `key`: remontar por contexto tira el contenido ya cargado y el
          panel parpadea en cada cambio de selección. El body ya se recarga. */}
      <ContextPreviewBody context={context} cwd={cwd} />
    </section>
  )
}
