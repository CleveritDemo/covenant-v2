import React from 'react'
import ReactDOM from 'react-dom/client'
import { initI18n } from '@i18n/index'
import { describeThrownValue } from '@shared/rendererErrorReport'
import { App } from './App'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { installRendererErrorReporting, reportRendererError } from './errorReporting'
import { installRendererVitals } from './rendererVitals'
import { dismissSplash, hideSplashNow } from './splash'
import './styles/global.css'

installRendererErrorReporting()
installRendererVitals()

function BootFailure({ message }: { message: string }): React.ReactElement {
  // Reusa el panel del boundary lanzando dentro de él: un único sitio con el
  // markup y las traducciones del fallo.
  throw new Error(message)
}

function mount(node: React.ReactNode): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootErrorBoundary>{node}</RootErrorBoundary>
    </React.StrictMode>,
  )
}

window.api
  .getConfig()
  .then(cfg => initI18n(cfg.language ?? 'en'))
  .then(() => {
    mount(<App />)
    dismissSplash()
  })
  .catch((err: unknown) => {
    // Sin este catch, un fallo aquí no monta nada y el splash se queda para
    // siempre: la app "no arranca" sin decir por qué.
    const { message, stack } = describeThrownValue(err)
    reportRendererError({ source: 'boot', message, stack })
    hideSplashNow()
    mount(<BootFailure message={message} />)
  })
