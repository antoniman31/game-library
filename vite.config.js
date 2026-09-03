import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// SteamGridDB et xbl.io n'exposent pas de CORS. En production, l'application passe
// par le relais Cloudflare (voir worker/), dont l'URL se règle dans l'onglet ⚙️.
//
// En développement, ce proxy joue le même rôle pour éviter d'avoir à déployer le
// Worker : il RELAIE simplement la requête. Il ne contient aucune clé — celle-ci
// est envoyée par le client dans l'en-tête Authorization / X-Authorization,
// exactement comme vers le Worker.
export default defineConfig({
  base: '/game-library/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Game Library',
        short_name: 'Game Library',
        description: 'Bibliothèque de jeux vidéo : suivi, temps de jeu, prêts et statistiques.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f0f1a',
        theme_color: '#5493FF',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La coquille de l'app est mise en cache pour un démarrage hors ligne.
        // Les appels aux API (RAWG, Wikipédia, relais CORS) ne sont jamais mis en
        // cache : ils doivent rester frais et échouer proprement sans réseau.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/game-library/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /steamgriddb\.com|rawg\.io|wikimedia\.org|xboxlive\.com|store-images/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'jaquettes',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/sgdb': {
        target: 'https://www.steamgriddb.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sgdb/, '/api/v2'),
      },
      '/xbl': {
        target: 'https://xbl.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xbl/, '/api/v2'),
      },
    },
  },
})
