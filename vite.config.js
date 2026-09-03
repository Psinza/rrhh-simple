import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config with a dev proxy for /api -> backend server on 4000
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
