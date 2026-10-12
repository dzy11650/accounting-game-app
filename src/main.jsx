import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import { UserProvider } from './store/UserContext.jsx'
import './styles/global.css'

// Debug: 记录路由变化（按3次Esc打开调试面板后查看）
const RouterDebugger = () => {
  const location = useLocation()
  console.log('[RouterDebug] 路由变化:', location.pathname)
  return null
}

// Debug Panel: 连按3次 Esc 打开/关闭，捕获 console/error/unhandledrejection
(function initDebugPanel() {
  let escPressCount = 0
  let escPressTimer = null
  let panelVisible = false

  function createPanel() {
    const div = document.createElement('div')
    div.id = 'debug-panel'
    div.style.cssText = 'position:fixed;top:60px;right:10px;width:360px;max-height:70vh;background:#1a1a2e;color:#eee;padding:16px;border-radius:12px;z-index:99999;font-size:12px;font-family:monospace;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);display:none;'
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong style="color:#4ecdc4;font-size:14px">🔧 Debug Panel</strong>
        <button id="close-debug" style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer">✕</button>
      </div>
      <div style="margin-bottom:8px"><strong style="color:#ffd93d">📋 Console Log:</strong></div>
      <pre id="debug-log" style="background:#0f0f1a;padding:10px;border-radius:8px;max-height:300px;overflow-y:auto;word-break:break-all;white-space:pre-wrap"></pre>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button id="copy-debug" style="flex:1;background:#4ecdc4;color:#1a1a2e;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:700">📋 复制日志</button>
        <button id="clear-debug" style="flex:1;background:#555;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer">🗑️ 清空</button>
      </div>
      <div style="margin-top:12px;font-size:11px;color:#888">提示：连按3次 Esc 打开/关闭此面板</div>
    `
    document.body.appendChild(div)

    const logEl = document.getElementById('debug-log')
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn

    console.log = function (...args) {
      originalConsoleLog.apply(console, args)
      logEl.textContent += '[LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'
      logEl.scrollTop = logEl.scrollHeight
    }
    console.error = function (...args) {
      originalConsoleError.apply(console, args)
      logEl.textContent += '[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'
      logEl.scrollTop = logEl.scrollHeight
    }
    console.warn = function (...args) {
      originalConsoleWarn.apply(console, args)
      logEl.textContent += '[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'
      logEl.scrollTop = logEl.scrollHeight
    }

    window.addEventListener('error', (e) => {
      logEl.textContent += '[EXCEPTION] ' + (e.message || String(e)) + '\n'
      logEl.scrollTop = logEl.scrollHeight
    })
    window.addEventListener('unhandledrejection', (e) => {
      logEl.textContent += '[UNHANDLED] ' + ((e.reason && (e.reason.message || e.reason)) || 'Promise rejection') + '\n'
      logEl.scrollTop = logEl.scrollHeight
    })

    document.getElementById('copy-debug').addEventListener('click', () => {
      navigator.clipboard.writeText(logEl.textContent).then(() => {
        const btn = document.getElementById('copy-debug')
        btn.textContent = '✅ 已复制!'
        setTimeout(() => btn.textContent = '📋 复制日志', 2000)
      })
    })
    document.getElementById('clear-debug').addEventListener('click', () => {
      logEl.textContent = ''
    })
    document.getElementById('close-debug').addEventListener('click', () => {
      div.style.display = 'none'
      panelVisible = false
    })
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      escPressCount++
      if (escPressTimer) clearTimeout(escPressTimer)
      escPressTimer = setTimeout(() => { escPressCount = 0 }, 500)
      if (escPressCount >= 3) {
        escPressCount = 0
        const panel = document.getElementById('debug-panel')
        if (!panel) createPanel()
        if (panel) {
          panelVisible = !panelVisible
          panel.style.display = panelVisible ? 'block' : 'none'
        }
      }
    }
  })
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <UserProvider>
        <RouterDebugger />
        <App />
      </UserProvider>
    </HashRouter>
  </StrictMode>,
)
