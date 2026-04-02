import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5174,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            // Cache all static assets
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            // Cache API responses (menu, settings) for offline
            runtimeCaching: [
              {
                urlPattern: /\/api\/v1\/menu$/,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'menu-cache',
                  expiration: { maxEntries: 1, maxAgeSeconds: 3600 },
                },
              },
              {
                urlPattern: /\/api\/v1\/settings$/,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'settings-cache',
                  expiration: { maxEntries: 1, maxAgeSeconds: 3600 },
                },
              },
              {
                // Cache food images from Unsplash
                urlPattern: /^https:\/\/images\.unsplash\.com\/.*/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'food-images',
                  expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 7 },
                },
              },
            ],
          },
          manifest: false, // We already have manifest.json in /public
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
