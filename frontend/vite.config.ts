import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['axis-mark.svg'],
      manifest: {
        name: 'AXIS — Agricultural Excellence in Irrigation Schemes',
        short_name: 'AXIS',
        description: 'Offline-friendly, explainable irrigation guidance for smallholder farmers.',
        theme_color: '#215c3b',
        background_color: '#f6f5ef',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/axis-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/catalog'),
          handler: 'NetworkFirst',
          options: { cacheName: 'axis-catalog', networkTimeoutSeconds: 3, expiration: { maxEntries: 2, maxAgeSeconds: 86400 } }
        }]
      }
    })
  ],
  server: { proxy: { '/api': 'http://localhost:8080' } },
  // Keep generated output below the tracked source marker so a build can clean
  // its own directory without making the Git worktree dirty.
  build: { outDir: '../backend/web/dist/generated', emptyOutDir: true }
})
