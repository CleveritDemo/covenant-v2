/**
 * ErrorBoundary raíz.
 *
 * Sin esto, un throw en render o en un efecto de commit hace que React 18
 * desmonte el árbol completo: `#root` se queda vacío, solo se ve el fondo del
 * tema y la app parece "en negro" aunque el proceso siga vivo. Aquí el fallo se
 * ve, se registra en `crash-diagnostics.log` y se puede recargar sin reiniciar.
 */

import React from 'react'
import { i18next } from '@i18n/index'
import { describeThrownValue } from '@shared/rendererErrorReport'
import { reportRendererError } from '../errorReporting'
import { hideSplashNow } from '../splash'
import { Button } from './ui/Button'
import './RootErrorBoundary.css'

/**
 * `i18next.t` con literal de respaldo: el boundary tiene que pintar aunque el
 * fallo haya sido el propio `initI18n` (ahí `t` devolvería la clave cruda).
 *
 * La firma de `i18next.t` exige una clave del union generado; aquí se llama con
 * `string` a propósito, para que este componente no dependa de que las claves
 * existan (si faltan, cae al literal).
 */
const translate = i18next.t as unknown as (key: string) => unknown

function t(key: string, fallback: string): string {
  try {
    const value = translate(key)
    return typeof value === 'string' && value !== key ? value : fallback
  } catch {
    return fallback
  }
}

interface Props {
  children: React.ReactNode
}

interface State {
  message: string
  stack?: string
  componentStack?: string
  failed: boolean
}

export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const { message, stack } = describeThrownValue(error)
    return { failed: true, message, stack }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const { message, stack } = describeThrownValue(error)
    const componentStack = info.componentStack ?? undefined
    this.setState({ componentStack })
    reportRendererError({ source: 'error-boundary', message, stack, componentStack })
    // El splash tapa la ventana entera: si el fallo fue durante el arranque,
    // sin esto el panel de error quedaría debajo.
    hideSplashNow()
  }

  private details(): string {
    return [this.state.message, this.state.stack, this.state.componentStack]
      .filter(Boolean)
      .join('\n\n')
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="root-error" role="alert">
        <div className="root-error__panel">
          <h1 className="root-error__title">
            {t('crash.title', 'La interfaz falló')}
          </h1>
          <p className="root-error__lead">
            {t(
              'crash.lead',
              'Se registró el detalle en crash-diagnostics.log. Recargar no pierde tu sesión: la guarda el proceso principal.',
            )}
          </p>
          <pre className="root-error__details">{this.details()}</pre>
          <div className="root-error__actions">
            <Button variant="primary" onClick={() => window.location.reload()}>
              {t('crash.reload', 'Recargar la interfaz')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(this.details())}
            >
              {t('crash.copy', 'Copiar detalle')}
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
