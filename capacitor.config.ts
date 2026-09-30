import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.accounting.game',
  appName: '会计小当家',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {}
}

export default config
