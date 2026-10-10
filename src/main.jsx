import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import './styles/global.css'

// Debug: 记录路由变化（按3次Esc打开调试面板后查看）
const RouterDebugger = () => {
  const location = useLocation()
  console.log('[RouterDebug] 路由变化:', location.pathname)
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <RouterDebugger />
      <App />
    </HashRouter>
  </StrictMode>,
)
