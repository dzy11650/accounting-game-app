import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { UserProvider } from './store/UserContext.jsx'
import './styles/global.css'

// 全局兜底：任何早期错误（含模块加载/解析失败）都显示出来，避免纯白屏无信息
function showFatal(msg, stack) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML =
    '<div style="padding:16px;font-family:sans-serif;color:#e74c3c">' +
    '<div style="font-weight:800;font-size:16px">⚠️ 启动出错</div>' +
    '<div style="margin-top:8px;font-weight:700;white-space:pre-wrap;word-break:break-all">' +
    String(msg || '') + '</div>' +
    (stack ? '<pre style="white-space:pre-wrap;font-size:12px;background:#fbeaea;padding:10px;border-radius:8px;margin-top:8px;max-height:300px;overflow:auto">' + String(stack) + '</pre>' : '') +
    '</div>'
}
window.addEventListener('error', (e) => {
  console.error('[global error]', e.error || e.message)
  if (e.message) showFatal(e.message, e.error && e.error.stack)
})
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason
  console.error('[unhandledrejection]', r)
  showFatal((r && (r.message || r)) || 'Unhandled Promise Rejection', r && r.stack)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <UserProvider>
        <App />
      </UserProvider>
    </HashRouter>
  </React.StrictMode>
)
