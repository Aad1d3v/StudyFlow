import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // The StudyFlow backend (accounts, data sync, AI proxy, Google OAuth
      // token proxy) is served same-origin through the dev server. In a
      // deployed build the frontend calls the backend directly (or a hosted
      // backend) via APP_CONFIG.apiBase.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Same-origin Google OAuth callback: the consent page redirects here and
      // the backend serves the page that hands the code back to the app.
      '/oauth/callback': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
