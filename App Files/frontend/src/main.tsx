// React entry point. Mounts the App into <div id="root"> from index.html.
//
// StrictMode is enabled in production builds (catches subtle bugs early) but
// disabled in dev so the development double-renders don't cause confusing
// duplicate fetches while iterating on the UI.
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'
import './index.css'

const rootElement = document.getElementById('root')

if (rootElement) {
  const app = <App />
  ReactDOM.createRoot(rootElement).render(
    import.meta.env.DEV ? app : <React.StrictMode>{app}</React.StrictMode>,
  )
}
