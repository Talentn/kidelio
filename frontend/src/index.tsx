import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root') as HTMLElement

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// LCP shell is home-only; admin and other routes hide it immediately (see index.html)
const isHome = window.location.pathname === '/' || window.location.pathname === ''
if (!isHome) {
  document.getElementById('lcp-shell')?.remove()
}
