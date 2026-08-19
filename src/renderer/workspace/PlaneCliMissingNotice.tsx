import React from 'react'
import { useT } from '@i18n/useT'
import './PlaneCliMissingNotice.css'

export interface PlaneCliMissingNoticeProps {
  /** 'cli' = falta CLI instalado; 'engine' = el agente no tiene motor elegido. */
  reason?: 'cli' | 'engine'
}

/**
 * Aviso inline cuando el envío del composer no puede salir: falta un CLI
 * de agente instalado y autenticado, o el agente no tiene motor configurado.
 */
export const PlaneCliMissingNotice: React.FC<PlaneCliMissingNoticeProps> = ({
  reason = 'cli',
}) => {
  const { t } = useT()

  return (
    <p className="plane-cli-missing-notice" role="status">
      {reason === 'engine' ? t('tabs.composerEngineMissing') : t('tabs.composerCliMissing')}
    </p>
  )
}
