import React from 'react'
import { useT } from '@i18n/useT'
import './PlaneCliMissingNotice.css'

/**
 * Aviso inline cuando el envío del composer no puede salir: falta un CLI
 * de agente instalado y autenticado.
 */
export const PlaneCliMissingNotice: React.FC = () => {
  const { t } = useT()

  return (
    <p className="plane-cli-missing-notice" role="status">
      {t('tabs.composerCliMissing')}
    </p>
  )
}
