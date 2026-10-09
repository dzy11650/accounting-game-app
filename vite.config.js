import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/accounting-game/', // Cloudflare Pages 需要
  plugins: [react()],
})
