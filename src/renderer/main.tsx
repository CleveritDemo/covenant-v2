import React from 'react'
import ReactDOM from 'react-dom/client'
import { initI18n } from '@i18n/index'
import { App } from './App'
import { dismissSplash } from './splash'
import './styles/global.css'

window.api.getConfig().then(cfg => {
  initI18n(cfg.language ?? 'en').then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    dismissSplash()
  })
})
