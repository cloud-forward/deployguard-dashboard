import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react'
          }

          if (
            id.includes('/@mui/') ||
            id.includes('/@emotion/')
          ) {
            return 'vendor-mui'
          }

          if (
            id.includes('/cytoscape/') ||
            id.includes('/cytoscape-fcose/') ||
            id.includes('/react-cytoscapejs/')
          ) {
            return 'vendor-cytoscape'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://analysis.deployguard.org',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
