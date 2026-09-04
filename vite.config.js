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
        // Identité de l'application, explicite plutôt que déduite.
        //
        // Sans ce champ, le navigateur dérive l'identité de `start_url` : le
        // jour où celui-ci change, l'application installée devient un fantôme
        // que plus rien ne met à jour, et la « nouvelle » s'installe à côté.
        // Deux PWA cohabitant sur antoniman31.github.io (celle-ci et
        // GTA6_WATCH), l'ambiguïté ne coûte rien à lever.
        //
        // La valeur reprend volontairement `start_url` : l'identité calculée
        // reste donc exactement celle d'aujourd'hui, et les installations
        // existantes ne sont pas orphelines.
        id: '/game-library/',
        name: 'Game Library',
        short_name: 'Game Library',
        description: 'Bibliothèque de jeux vidéo Xbox et Switch : catalogue, prêts et statistiques.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        // Ces deux couleurs habillent l'application AVANT qu'elle s'exécute :
        // l'écran de démarrage de la PWA installée, et la barre système autour
        // d'elle. Elles étaient restées sur le bleu nuit d'un thème sombre qui
        // n'existe plus, et sur le bleu de l'accent : au lancement, un cadre
        // bleu s'affichait une seconde autour d'une application noire.
        // Une fois l'app démarrée, App.jsx ajuste la barre au thème réel.
        background_color: '#000000',
        theme_color: '#000000',
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
