import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Load built CSS without blocking first paint (production HTML only). */
function asyncCssPlugin(): Plugin {
  return {
    name: 'async-css',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet"([^>]*?)href="(\/assets\/[^"]+\.css)"([^>]*)>/g,
        '<link rel="preload" as="style" href="$2" onload="this.onload=null;this.rel=\'stylesheet\'"$1$3>' +
        '<noscript><link rel="stylesheet" href="$2"></noscript>'
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), asyncCssPlugin()],
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
    target: 'es2020',
    cssCodeSplit: true,
    modulePreload: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/AdminApp') || id.includes('/pages/admin/') || id.includes('/components/admin/')) {
            return 'admin'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/react-helmet-async') || id.includes('node_modules/helmet')) {
            return 'vendor-helmet'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
        },
      },
    },
  },
})
