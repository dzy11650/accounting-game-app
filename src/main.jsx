import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Debug: 记录路由变化
const RouterDebugger = () => {
  const location = useLocation()
  console.log('[RouterDebug] 路由变化:', location.pathname)
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RouterDebugger />
      <App />
    </BrowserRouter>
  </StrictMode>,
)
