import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 360,
    minHeight: 640,
    title: '会计小当家',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(DIST, 'index.html'))
  // 手机端 App 观感：隐藏菜单栏
  win.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
