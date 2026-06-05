import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api':    { target: 'http://localhost:3001', changeOrigin: true },
      '/rails':  { target: 'http://localhost:3001', changeOrigin: true },
      '/users':  { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
      '/go': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/go/, ''),
      },
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Warn when chunks > 500 KB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor — cached indefinitely (content-hashed)
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/react-helmet-async') || id.includes('node_modules/helmet')) {
            return 'vendor-helmet'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          // Pixel init stays in the main chunk (imported by eager components).
          // Pixel events go into page-component chunks (imported only by lazy pages).
        },
      },
    },
  },
})
