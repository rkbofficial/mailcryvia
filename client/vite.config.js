import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/unsubscribe': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})
