// React entry point. Mounts the App into <div id="root"> from index.html.
//
// StrictMode is enabled in production builds (catches subtle bugs early) but
// disabled in dev so the development double-renders don't cause confusing
// duplicate fetches while iterating on the UI.
//
// i18n is initialized as a side effect of importing './i18n' so language
// resources are ready before any component calls useTranslation().
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'
import './i18n'
import './index.css'

const rootElement = document.getElementById('root')

if (rootElement) {
  const app = <App />
  ReactDOM.createRoot(rootElement).render(
    import.meta.env.DEV ? app : <React.StrictMode>{app}</React.StrictMode>,
  )
}
