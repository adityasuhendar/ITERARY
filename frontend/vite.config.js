import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['AppImages (4)/**/*.png'],
      manifest: {
        name: 'ITERARY - Library Management System',
        short_name: 'ITERARY',
        description: 'ITERA Library And Reading facilitY - Sistem manajemen perpustakaan modern',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'AppImages (4)/android/android-launchericon-48-48.png',
            sizes: '48x48',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'AppImages (4)/android/android-launchericon-72-72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'AppImages (4)/android/android-launchericon-96-96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'AppImages (4)/android/android-launchericon-144-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'AppImages (4)/android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'AppImages (4)/android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'AppImages (4)/ios/16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/20.png',
            sizes: '20x20',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/29.png',
            sizes: '29x29',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/40.png',
            sizes: '40x40',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/50.png',
            sizes: '50x50',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/57.png',
            sizes: '57x57',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/58.png',
            sizes: '58x58',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/60.png',
            sizes: '60x60',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/76.png',
            sizes: '76x76',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/80.png',
            sizes: '80x80',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/87.png',
            sizes: '87x87',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/100.png',
            sizes: '100x100',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/114.png',
            sizes: '114x114',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/120.png',
            sizes: '120x120',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/167.png',
            sizes: '167x167',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/180.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/256.png',
            sizes: '256x256',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'AppImages (4)/ios/1024.png',
            sizes: '1024x1024',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/iterary.*\.run\.app\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400 // 24 hours
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
