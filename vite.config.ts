import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    proxy: {
      // The StudyFlow backend (accounts, data sync, AI proxy, and the Google
      // OAuth token proxy) is served same-origin through the dev server so no
      // CORS setup is needed. The packaged Tauri app calls the backend
      // directly at http://127.0.0.1:8787 (see APP_CONFIG.apiBase).
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
