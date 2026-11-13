import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Fixed ports, so the address you add to Kobello stays the same.
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
  plugins: [
    react(),
    // Makes the app a PWA: its service worker saves every file of the app,
    // so it opens in Kobello without internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'kobello.json'],
      manifest: {
        name: 'Notes',
        short_name: 'Notes',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
});
