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
