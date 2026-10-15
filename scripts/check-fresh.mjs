import { existsSync, statSync } from 'fs'
import { readdirSync } from 'fs'
import { join } from 'path'

const distHtmlPath = 'dist/index.html'
const srcDirs = ['src/lib', 'src/pages', 'src/components', 'src/data']

if (!existsSync(distHtmlPath)) {
  console.error('[check-fresh] ERROR: dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

const distMtime = statSync(distHtmlPath).mtimeMs

function getNewestMtime(dir) {
  let newest = 0
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath)
        }
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
        const mtime = statSync(fullPath).mtimeMs
        if (mtime > newest) newest = mtime
      }
    }
  }
  walk(dir)
  return newest
}

let stale = false
for (const dir of srcDirs) {
  if (!existsSync(dir)) continue
  const newestSrc = getNewestMtime(dir)
  if (newestSrc > distMtime) {
    console.error(`[check-fresh] WARNING: ${dir} has files newer than dist/index.html`)
    stale = true
  }
}

if (stale) {
  console.error('[check-fresh] ERROR: src is newer than dist! Please rebuild.')
  process.exit(1)
}

console.log('[check-fresh] OK: dist is up to date.')
