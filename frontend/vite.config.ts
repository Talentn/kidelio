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
        manualChunks: {
          // React core — changes rarely, cached forever
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Helmet — tiny, separate for clean splitting
          'vendor-helmet': ['react-helmet-async'],
          // Icons — large, rarely changes
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
